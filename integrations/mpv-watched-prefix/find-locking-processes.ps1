param([Parameter(Mandatory = $true)][string]$Path)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class RestartManagerLockProbe {
    const int ERROR_MORE_DATA = 234;

    [StructLayout(LayoutKind.Sequential)]
    public struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    public enum RM_APP_TYPE { Unknown = 0, MainWindow = 1, OtherWindow = 2, Service = 3, Explorer = 4, Console = 5, Critical = 1000 }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string strServiceShortName;
        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)] public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)] static extern int RmStartSession(out uint handle, int flags, string key);
    [DllImport("rstrtmgr.dll", CharSet = CharSet.Unicode)] static extern int RmRegisterResources(uint handle, uint fileCount, string[] files, uint appCount, RM_UNIQUE_PROCESS[] apps, uint serviceCount, string[] services);
    [DllImport("rstrtmgr.dll")] static extern int RmGetList(uint handle, out uint needed, ref uint count, [In, Out] RM_PROCESS_INFO[] infos, ref uint rebootReasons);
    [DllImport("rstrtmgr.dll")] static extern int RmEndSession(uint handle);

    public static RM_PROCESS_INFO[] Find(string[] files) {
        uint handle;
        int result = RmStartSession(out handle, 0, Guid.NewGuid().ToString("N"));
        if (result != 0) throw new Exception("RmStartSession=" + result);
        try {
            result = RmRegisterResources(handle, (uint)files.Length, files, 0, null, 0, null);
            if (result != 0) throw new Exception("RmRegisterResources=" + result);
            uint needed = 0, count = 0, rebootReasons = 0;
            result = RmGetList(handle, out needed, ref count, null, ref rebootReasons);
            if (result == 0) return new RM_PROCESS_INFO[0];
            if (result != ERROR_MORE_DATA) throw new Exception("RmGetList=" + result);
            var infos = new RM_PROCESS_INFO[needed];
            count = needed;
            result = RmGetList(handle, out needed, ref count, infos, ref rebootReasons);
            if (result != 0) throw new Exception("RmGetList=" + result);
            Array.Resize(ref infos, (int)count);
            return infos;
        } finally {
            RmEndSession(handle);
        }
    }
}
'@

$files = @(Get-ChildItem -LiteralPath $Path -File -Force | ForEach-Object FullName)
$lockers = if ($files.Count) { [RestartManagerLockProbe]::Find($files) } else { @() }
$result = @($lockers | ForEach-Object {
    $processId = $_.Process.dwProcessId
    $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
    [pscustomobject]@{
        pid = $processId
        name = if ($process) { $process.ProcessName + '.exe' } else { 'unknown' }
        app = $_.strAppName
        type = [string]$_.ApplicationType
        restartable = $_.bRestartable
    }
})
ConvertTo-Json -InputObject $result -Compress
