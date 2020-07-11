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
    const serviceMap = []
    const watchEventList = []
  
    function OneSocket(option) {
      this.defaultOption = {
        url: '',
        mode: 'vague', // 可选参数 exact， vague
        timeout: 13000,
        interval: 50,
        heartbeatInterval: 100000,
        heartbeatPack: {
          lang: "zh_cn",
          service: "ping",
          token: "b504014e-ca8b-4770-b922-cb5493bbee9d"
        },
        responseParser: function(res, next, scope) {
          const data = JSON.parse(res.data)
          const service = data.service
          const { result_code } = data
          next(data, service, result_code === 1, scope)
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
        if (resolve) {
          resolve(true)
          promiseCallback = {}
        }
      })
  
      ws.addEventListener('close', function() {
        // socket关闭后，将停止所有请求
        clearTimeout(that.timer)
        clearTimeout(that.heartbeatTimer)
        console.warn('socket has closed')
        if (reject) {
          reject(false)
          promiseCallback = {}
        } else {
          watchEventList['error'].forEach((callback) => {
            callback(err)
          })
        }
      })
  
      ws.addEventListener('error', function(err) {
        if (reject) {
          reject(false)
          promiseCallback = {}
        } else {
          watchEventList['error'].forEach((callback) => {
            callback(err)
          })
        }
      })
  
      ws.onmessage = function(res) {
        that.defaultOption.responseParser(res, messageHouse, that)
      }
    }
  
    const messageHouse = function(res, service, isSuccess, that) {
      let path = null
      let watchedName = null
      if(that.defaultOption.mode === 'exact'){
        path = service.id
        watchedName = service.service
      } else {
        path = service.service
        watchedName = service.service
      }
      if (!path || (serviceMap.indexOf(path) < 0 && !watchEventList[watchedName])) {
        console.warn(path + ' is not a service')
        return
      }
      (watchEventList[watchedName] || []).forEach(function(callback) {
        callback(res)
      })
      if (!that.callbackMap[path]) return
      const callback = that.callbackMap[path].shift()
      if (isSuccess) {
        callback ? callback[0](res) : console.error('callback is undefined')
      } else {
        callback ? callback[1](res) : console.error('callback is undefined')
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
      }, that.defaultOption.interval)
    }
  
    const heartbeat = function(that) {
      const { heartbeatPack, heartbeatInterval } = that.defaultOption
      that.heartbeatTimer = setTimeout(function() {
        ws.send(JSON.stringify(Object.assign({}, heartbeatPack, {
          id: uuid()
        })))
        heartbeat(that)
      }, heartbeatInterval)
    }
  
    function uuid() {
      var s = [];
      var hexDigits = "0123456789abcdef";
      for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
      }
      s[14] = "4"; // bits 12-15 of the time_hi_and_version field to 0010
      s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1); // bits 6-7 of the clock_seq_hi_and_reserved to 01
      s[8] = s[13] = s[18] = s[23] = "-";
  
      var uuid = s.join("");
      return uuid;
    }
  
    OneSocket.prototype.sendData = function(path, data) {
      const uuidString = uuid()
      const { mode } = this.defaultOption
  
      if (mode === 'exact') {
        path = uuidString
      }
  
      serviceMap.push(path)
      return new Promise(function(resolve, reject) {
        if (!this.callbackMap[path]) {
          this.callbackMap[path] = [
            [resolve, reject]
          ]
        } else {
          this.callbackMap[path].push([resolve, reject])
        }
        if (mode === 'exact') {
          data = Object.assign({}, data, { id: uuidString })
        }
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
        return callback(err)
      })
    }
  
    OneSocket.prototype.onHeartbeat = function(callback) {
      serviceMap.push('ping')
      this.defaultOption.heartbeatCallback = callback
    }
  
    OneSocket.prototype.on = function(name, callback) {
      if (watchEventList[name]) {
        watchEventList[name].push(callback)
      } else {
        watchEventList[name] = [callback]
      }
    }
  
    OneSocket.prototype.remove = function(name, callback) {
      const index = watchEventList[name].findIndex(item => {
        return item === callback
      })
      watchEventList.splice(index, 1)
    }
  
    OneSocket.prototype.destory = function(name) {
      delete watchEventList[name]
    }
    return OneSocket
  })
  