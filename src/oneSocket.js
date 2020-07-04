(function(name, definition) {
    // 检测上下文环境是否为AMD或CMD
    var hasDefine = typeof define === 'function',
        // 检查上下文环境是否为Node
        hasExports = typeof module !== 'undefined' && module.exports
    if (hasDefine) {
        // AMD环境或CMD环境
        define(definition)
    } else if (hasExports) {
        // 定义为普通Node模块
        module.exports = definition()
    } else {
        // 将模块的执行结果挂在window变量中，在浏览器中this指向window对象
        window[name] = definition()
    }
})('oneSocket', function() {
    if (!WebSocket) {
        console.warn('WebSocket is not exist')
    }
    let ws = null
    let promiseCallback = []
    const dataQueue = []

    function OneSocket(option) {
        this.defaultOption = {
            url: '',
            pathKey: 'service',
            timeout: 13000,
            heartbeatPack: {
                lang: "zh_cn",
                service: "ping",
                token: "b504014e-ca8b-4770-b922-cb5493bbee9d"
            }
        }
        this.callbackMap = {}
        this.defaultOption = Object.assign({}, this.defaultOption, option)
        this.heartbeatTimer = null
        this.init(option)
        this.__Promise__ = new Promise(function(resolve, reject) {
            promiseCallback = { resolve, reject }
            bindEvent(this)
        }.bind(this))
    }

    OneSocket.prototype.init = function() {
        try {
            ws = new WebSocket(this.defaultOption.url)
        } catch (err) {
            promiseCallback[1](err)

        }
        ws.timeoutInterval = this.defaultOption.timeout
    }

    const bindEvent = function(that) {
        const { resolve, reject } = promiseCallback
        ws.addEventListener('open', function() {
            resolve(true)
        })

        ws.addEventListener('close', function() {
            // socket关闭后，将停止所有请求
            clearTimeout(this.timer)
            clearTimeout(this.heartbeatTimer)
        }.bind(this))

        ws.addEventListener('error', function() {
            reject(false)
        })

        ws.onmessage = function(res) {
            const data = JSON.parse(res.data)
            messageHouse(data, that)
        }
    }

    const messageHouse = function(res, that) {
        const { result_code, result_data } = res
        const service = (result_data || {})[that.defaultOption.pathKey]
        if (!service || service === that.defaultOption.pathKey) return
        const callback = that.callbackMap[service]
        if (result_code === 1) {
            callback && callback[0](res) && delete that.callbackMap[service]
        } else {
            callback && callback[1](res) && delete that.callbackMap[service]
        }

    }

    const queueSend = function(data, that) {
        dataQueue.push(data)
        if (!status) {
            send(that)
        }
    }

    const send = function(that) {
        status = true
            //  如果在心跳请求等待时间内再次发送请求，则心跳请求取消
        clearTimeout(that.heartbeatTimer)
        that.timer = setTimeout(function() {
            const data = dataQueue.shift()
            ws.send(data)
                //  发请求后准备执行心跳请求
            heartbeat(that)
            if (dataQueue.length) {
                send(that)
            } else {
                status = false
            }
        }, 50)
    }

    const heartbeat = function(that) {
        const { heartbeatPack, timeout } = that.defaultOption
        that.heartbeatTimer = setTimeout(function() {
            ws.send(JSON.stringify(heartbeatPack))
            heartbeat(that)
        }, timeout)
    }

    OneSocket.prototype.sendData = function(path, data) {
        return new Promise(function(resolve, reject) {
            this.callbackMap[path] = [resolve, reject]
            queueSend(JSON.stringify(data), this)
        }.bind(this))
    }

    OneSocket.prototype.close = function() {
        // socket关闭后，将停止所有请求
        clearTimeout(this.timer)
        clearTimeout(this.heartbeatTimer)
        ws.close()
    }

    OneSocket.prototype.then = function(callback) {
        return this.__Promise__.then(function(data) {
            return callback(this)
        }.bind(this))
    }

    OneSocket.prototype.catch = function(callback) {
        return this.__Promise__.catch(function(err) {
            callback(err)
        })
    }

    return OneSocket
})