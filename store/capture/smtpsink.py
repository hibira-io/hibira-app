import socketserver, sys, time, os
OUT=sys.argv[1]
class H(socketserver.StreamRequestHandler):
    def w(self,s): self.wfile.write((s+"\r\n").encode())
    def handle(self):
        self.w("220 sink")
        data=False; buf=[]
        while True:
            line=self.rfile.readline()
            if not line: return
            s=line.decode('utf-8','replace').rstrip('\r\n')
            if data:
                if s=='.':
                    data=False
                    with open(os.path.join(OUT,'%f.eml'%time.time()),'w') as f: f.write("\n".join(buf))
                    buf=[]; self.w("250 ok"); continue
                buf.append(s[1:] if s.startswith('..') else s); continue
            u=s.upper()
            if u.startswith('EHLO'): self.w("250-sink"); self.w("250 8BITMIME")
            elif u.startswith('DATA'): data=True; self.w("354 go")
            elif u.startswith('QUIT'): self.w("221 bye"); return
            else: self.w("250 ok")
class T(socketserver.ThreadingMixIn, socketserver.TCPServer): allow_reuse_address=True
os.makedirs(OUT,exist_ok=True)
T(('127.0.0.1',2525),H).serve_forever()
