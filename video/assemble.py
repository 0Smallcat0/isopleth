import json, subprocess
T = json.load(open('out/timing.json')); st = T['starts']
ks = sorted(st, key=lambda x: int(x[1:])); ins = []; flt = []
for i, k in enumerate(ks):
    ins += ['-i', f'vo/{k}.mp3']; ms = int(st[k] * 1000); flt.append(f'[{i}:a]adelay={ms}|{ms},apad[a{i}]')
n = len(ks)
f = ';'.join(flt) + ';' + ''.join(f'[a{i}]' for i in range(n)) + f'amix=inputs={n}:normalize=0:duration=longest,atrim=0:{T["total"]:.3f}[m]'
subprocess.run(['ffmpeg', '-y', '-v', 'error'] + ins + ['-filter_complex', f, '-map', '[m]', '-ar', '48000', '-ac', '2', 'out/vo-raw.wav'], check=True)
r = subprocess.run(['ffmpeg', '-v', 'info', '-i', 'out/vo-raw.wav', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=7:print_format=json', '-f', 'null', '-'], capture_output=True, text=True)
m = json.loads(r.stderr[r.stderr.rindex('{'):r.stderr.rindex('}') + 1])
af = f"loudnorm=I=-14:TP=-1.5:LRA=7:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', 'out/vo-raw.wav', '-af', af, '-ar', '48000', 'out/vo.wav'], check=True)
subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', 'frames/list.txt', '-i', 'out/vo.wav', '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-crf', '17', '-preset', 'slow', '-r', '30', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'out/isopleth-demo.mp4'], check=True)
