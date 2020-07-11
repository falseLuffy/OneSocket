/**
 * create by falseLuffy
 **/
const WebSocket = require('ws');
// const appendLog = require('./logs/index')

const server = new WebSocket.Server({ port: 20001 });

console.log(new Date().toUTCString() + "启动一个websocket服务,端口号为20001")

server.on('open', function open(ws, req) {
  console.log(`connect a client ${req.headers['x-real-ip']}`);
});

server.on('close', function close(ws, req) {
  console.log(`${req.headers['x-real-ip']} has disconnected`);
});

server.on('connection', function connection(ws, req) {
  const ip = req.headers['x-real-ip'];
  // const port = req.connection.remotePort;
  const clientName = ip;

  console.log(`connect a client ${ip}`);

  // 发送欢迎信息给客户端
  // ws.send("Welcome " + clientName);

  ws.on('message', function incoming(message) {
    // appendLog(message, clientName)
    // 广播消息给所有客户端
    // server.clients.forEach(function each(client) {
    //   if (client.readyState === WebSocket.OPEN) {
    //     client.send( clientName + " -> " + message);
    //   }
    // });

    let timeout = parseInt(1000 + Math.random() * 2000)
    setTimeout(() => {
      ws.send(JSON.stringify(Object.assign({}, JSON.parse(message), {
        result_code: 1,
        result_data: [],
        timeout: timeout
      })));
    }, timeout)
  });
});
