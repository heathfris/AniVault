local mp = require 'mp'
local utils = require 'mp.utils'
local options = require 'mp.options'

local opts = {
    project_root = '',
    node_path = '',
    state_dir = '',
}
options.read_options(opts, 'anivault-watched')

local function join(base, name)
    local separator = base:match('[\\/]$') and '' or '/'
    return base .. separator .. name
end

local function read_trimmed(file)
    local handle = io.open(file, 'r')
    if not handle then return nil end
    local value = handle:read('*a')
    handle:close()
    return value and value:match('^%s*(.-)%s*$') or nil
end

local enabled = read_trimmed(join(opts.state_dir, 'enabled.flag'))
if enabled ~= 'yes' then
    return
end

if opts.project_root == '' or opts.node_path == '' or opts.state_dir == '' then
    mp.msg.error('anivault-watched: script options are incomplete')
    return
end

local pid = mp.get_property_number('pid', 0)
local session_file = join(opts.state_dir, string.format('session-%d-%d.jsonl', pid, os.time()))
local seq = 0
local current = nil

local function append_event(value)
    local handle = io.open(session_file, 'a')
    if not handle then
        mp.msg.error('anivault-watched: cannot append ' .. session_file)
        return false
    end
    handle:write(utils.format_json(value), '\n')
    handle:flush()
    handle:close()
    return true
end

local function flush_current()
    if not current then return end
    if current.eligible_pending <= 0 and current.max_time_pos <= 0 then return end
    seq = seq + 1
    local event = {
        v = 1,
        seq = seq,
        path = current.path,
        size = current.size,
        mtime = current.mtime,
        duration = current.duration,
        eligible_delta = current.eligible_pending,
        time_pos = current.max_time_pos,
        at = os.date('!%Y-%m-%dT%H:%M:%SZ'),
    }
    if append_event(event) then current.eligible_pending = 0 end
    current.last_flush = mp.get_time()
end

local function load_file()
    local file = mp.get_property('path')
    local duration = mp.get_property_number('duration', 0)
    if not file or not file:match('^[A-Za-z]:[\\/]') or duration <= 0 then
        current = nil
        return
    end
    local info = utils.file_info(file)
    if not info or not info.is_file then
        current = nil
        return
    end
    local now = mp.get_time()
    current = {
        path = file,
        size = info.size or 0,
        mtime = info.mtime or 0,
        duration = duration,
        eligible_pending = 0,
        max_time_pos = 0,
        last_sample = now,
        last_flush = now,
    }
end

local function can_count()
    return not mp.get_property_bool('pause', false)
        and not mp.get_property_bool('core-idle', false)
        and not mp.get_property_bool('paused-for-cache', false)
        and not mp.get_property_bool('seeking', false)
end

local function sample()
    if not current then return end
    local now = mp.get_time()
    local delta = math.max(0, now - current.last_sample)
    current.last_sample = now
    local time_pos = mp.get_property_number('time-pos', 0)
    if time_pos >= 0 then current.max_time_pos = math.max(current.max_time_pos, time_pos) end
    if can_count() then current.eligible_pending = current.eligible_pending + math.min(delta, 2) end
    if now - current.last_flush >= 10 then flush_current() end
end

local function end_file()
    sample()
    flush_current()
    current = nil
end

local function on_shutdown()
    sample()
    flush_current()
    local helper = join(opts.project_root, 'integrations/mpv-watched-prefix/apply-watched-prefix.js')
    utils.subprocess_detached({
        args = {
            opts.node_path,
            helper,
            '--pid=' .. tostring(pid),
            '--project-root=' .. opts.project_root,
            '--state-dir=' .. opts.state_dir,
            '--session=' .. session_file,
        },
        cancellable = false,
    })
end

mp.register_event('file-loaded', load_file)
mp.register_event('end-file', end_file)
mp.register_event('shutdown', on_shutdown)
mp.add_periodic_timer(1, sample)
