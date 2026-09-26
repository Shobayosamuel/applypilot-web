# Fake Claude Messages API: answers each forced tool by name with plausible output.
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def do_POST(self):
        req = json.loads(self.rfile.read(int(self.headers['content-length'])))
        tool = (req.get('tool_choice') or {}).get('name')
        user = req['messages'][0]['content'][-1]['text'] if req['messages'][0]['content'][-1]['type']=='text' else ''
        content = None
        if tool == 'fill_fields':
            fields = json.loads(user.split('<form_fields>')[1].split('</form_fields>')[0])
            vals = []
            for f in fields:
                l = f['label'].lower()
                if 'authorized' in l: vals.append({'id': f['id'], 'value': 'Yes'})
                elif 'gender' in l: vals.append({'id': f['id'], 'value': 'Decline to self identify'})
                elif 'hear' in l: vals.append({'id': f['id'], 'value': 'Company website'})
                elif 'years' in l: vals.append({'id': f['id'], 'value': 'Seven'})  # not an option -> server drops it
            content = [{'type':'tool_use','id':'t1','name':tool,'input':{'values': vals}}]
        elif tool == 'save_job':
            content = [{'type':'tool_use','id':'t1','name':tool,'input':{'title':'X','company':'Y','location':'','description':''}}]
        elif tool == 'report_match':
            content = [{'type':'tool_use','id':'t1','name':tool,'input':{'score':82,'verdict':'good','summary':'Strong Go and payments background.','matched_skills':['Go'],'missing_skills':['Kubernetes'],'keywords':['Go'],'suggestions':['Mention RabbitMQ']}}]
        else:
            content = [{'type':'text','text':'I have spent three years building payment systems in Go, which maps directly to this role.'}]
        body = json.dumps({'model': req['model'], 'stop_reason':'end_turn', 'content': content,
                           'usage': {'input_tokens': 100, 'output_tokens': 20, 'cache_read_input_tokens': 50}}).encode()
        self.send_response(200); self.send_header('content-type','application/json'); self.end_headers(); self.wfile.write(body)

HTTPServer(('127.0.0.1', 9099), H).serve_forever()
