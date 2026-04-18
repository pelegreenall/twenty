const pty = require('child_process');
const child = pty.spawn('yarn', ['twenty', 'add', 'logicFunction'], {stdio: ['pipe','pipe','pipe']});
let state = 0;
child.stdout.on('data', d => {
  const out = d.toString();
  process.stdout.write(out);
  if (out.includes('name for your logic function') && state === 0) { state++; child.stdin.write('sendSurvey\n'); }
  else if (out.includes('description') && state === 1) { state++; child.stdin.write('Sends survey using Brevo\n'); }
  else if (out.includes('icon') && state === 2) { state++; child.stdin.write('\n'); }
  else if (out.includes('tool') && state === 3) { state++; child.stdin.write('Y\n'); }
});
setTimeout(() => child.kill(), 10000);
