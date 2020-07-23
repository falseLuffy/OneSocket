# OneSocket 
### 我们的口号是“像使用axios和fetch 一样使用websocket”

OneSocket 是一个是用来实现单socket通信websocket工具，实现了顺序队列请求，每个请求可以有50ms（可配置）的间隔时间，并自带心跳请求。支持Promise调用，只要做一些简单的配置，可以像使用axios那样简单的使用socket请求了

以前我们写http请求是这样的
```
const xhr = new XMLHttpRequest()
xhr.onreadystatechange = function(){
    if(xhr.readyState === 4) {
        if(xhr.status === 200){
            is ok
        } else {

        }
    }
}
xhr.open('get, url, true)
xhr.send(data)

```
写起来很烦，逻辑也很感人。。


后来有了axios  我们发送请求时只要这样
```
axios.get('path').then((res) => {
    console.log(res)
})
```

代码很少，工作很轻松，逻辑清晰，维护很简单

以前我们写socket

```
const socket = new WebSocket(src)

socket.addEventListener('open', function() {
    socket.send(JSON.stringy({
        service: 'connect',
        data: '连上了'
    }))
})
socket.addEventListener('close',function(){
    
})

socket.addEventListener('message', function(res) {
    const data = JSON.parse(res.data)

    if (data.result_data.service === 'connect') {
        console.log('连上了')
    } else if (data.result_data.service === 'state') {

    }
})


```

写完这些我想打人，为什么要我承担这些。。

现在我们有了OneSocket

```
try{
    const socket = await new OneSocket({
        url: 'ws://192.168.69.60:8082/ws/home/overview'
    })
} catch((err) => {
    console.log(err)
})

socket.send('login', data).then((res) =>{
    console.log(res)
})

socket.send('getList', data).then(() => {
    
})
socket.send('getUser', data).then(() => {

})

socket.on('notice', function() {

})

or

new OneSocket({
    url: 'ws://192.168.69.60:8082/ws/home/overview'
}).then((ws) => {
    ws.send('login', data).then(() => {

    })
    ws.send('getList', data).then(() => {
        
    })
    ws.send('getUser', data).then(() => {
        
    })

    ws.on('notice', function() {

    })
})

```
这样我们就能有个非常清晰的业务逻辑，不论开发和维护过程中都将非常简单



### 配置项
|字段名|类型|默认值|描述|
|-----------------|--------------|-------------|-----------------|
|url              |string|required     | socket请求地址 |
|timeout          |number|默认10000     | socket请求时间|
|interval         |number|默认50ms      | 每个请求的延迟时间|
|mode             |string|              |                  |
|                 |      |可选参数 vague|模糊模式，使用service名定位回调，较为模糊，每个service可能对应多个回调|
|                 |      |可选参数exact |根据uuid定位回调,定位准确，每个uuid对应唯一回调
|hasHeartbeat     |boolean|             |是否存在心跳请求，默认true
|heartbeatInterval|number|10000        |心跳请求的间隔时间
|heartbeatPack    |Object|             |JSONString 心跳请求数据
|responseParser   |function| required    |  socket请求返回数据解析函数


### API
|方法名|功能|参数|
|---|---|----|
| send | 发送数据 |无参数
| close|  关闭请求 |无参数
| updateConfig|  更新配置项| Object: {heartbeatPack:{}}
| on|  监听后端主动推送的消息 |参数：name,callback
| remove | 移除用户监听的消息的一个回调，| 参数：name,callback
| destory |销毁指定名称的所有监控回调，|参数； name 