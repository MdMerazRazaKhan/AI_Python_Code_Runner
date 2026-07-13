const WebSocket = require('c:/Users/nargi/OneDrive/Pictures/Desktop/MERAZ/AI_Virtual_project/backend/node_modules/ws');

const ws = new WebSocket('ws://localhost:5000');

let gotPrompt = false;
let gotOutput = false;
let exitSuccess = false;

ws.on('open', () => {
  console.log('CONNECTED TO WEBSOCKET');
  ws.send(JSON.stringify({
    type: 'run',
    code: `n = int(input("enter the value : "))\nfor i in range(n):\n    print(i)`
  }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data);
  console.log('WS MSG:', msg);

  if (msg.type === 'stdout') {
    if (msg.data.includes('enter the value :')) {
      console.log('GOT PROMPT! SENDING INPUT...');
      gotPrompt = true;
      // Send stdin input
      ws.send(JSON.stringify({ type: 'stdin', data: '5\n' }));
    }
    if (msg.data.includes('0') && msg.data.includes('4')) {
      gotOutput = true;
    }
  }

  if (msg.type === 'exit') {
    if (msg.status === 'Success') {
      exitSuccess = true;
    }
    console.log('RUN FINISHED. EXIT STATUS:', msg.status);
    ws.close();
  }
});

ws.on('close', () => {
  console.log('WS CLOSED');
  if (gotPrompt && exitSuccess) {
    console.log('TEST PASSED! REAL-TIME BIDIRECTIONAL STREAMING STDIN SUCCESSFUL!');
  } else {
    console.log('TEST FAILED!');
  }
});

ws.on('error', (err) => {
  console.error('WS ERROR:', err);
});
