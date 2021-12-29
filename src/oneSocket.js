if (!WebSocket) {
  throw new Error('WebSocket is not exist')
}

function uuid () {
  var s = []
  var hexDigits = '0123456789abcdef'
  for (var i = 0; i < 36; i++) {
    s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1)
  }
  s[14] = '4' // bits 12-15 of the time_hi_and_version field to 0010
  s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1) // bits 6-7 of the clock_seq_hi_and_reserved to 01
  s[8] = s[13] = s[18] = s[23] = '-'

  return s.join('')
}

export default class OneSocket {
  ws = null
  promiseCallback = []
  dataQueue = []
  watchEventList = {}
  sendStatus = false
  timeoutTimer = null

  bindEvent = (that) => {
    const { resolve, reject } = this.promiseCallback
    this.ws.addEventListener('open',  () => {
      clearTimeout(this.timeoutTimer)
      if (resolve) {
        resolve(true)
        this.promiseCallback = {}
        if (that.defaultOption.hasHeartbeat) this.heartbeat(that)
      }
    })

    this.ws.addEventListener('close',  (err) => {
      clearTimeout(this.timeoutTimer)
      // socket关闭后，将停止所有请求
      clearTimeout(that.timer)
      clearTimeout(that.heartbeatTimer)
      console.warn('socket has closed')
      that.defaultOption.onClose(err)
    })

    this.ws.addEventListener('error', (err) => {
      if (reject) {
        reject(false)
        this.promiseCallback = {}
      } else {
        this.watchEventList.error.forEach((callback) => {
          callback(err)
        })
      }
    })

    this.ws.addEventListener('message',  (res) => {
      that.defaultOption.responseParser(res, this.messageHouse, that)
    })
  }

  messageHouse = (res, service, isSuccess, that) => {
    let path = null
    const watchedName = service.service
    if (that.defaultOption.mode === 'exact') {
      path = service.id
    } else {
      path = service.service
    }

    if (!path || (!that.watchEventList[watchedName])) {
      // process.env.NODE_ENV === 'development' && console.warn(path + ' is not a defined service');
      return
    }
    (that.watchEventList[watchedName] || []).forEach( (callback) => {
      callback(res)
    })
    if (!that.callbackMap[path]) return
    const callback = that.callbackMap[path].shift()
    if (!that.callbackMap[path].length) that.callbackMap[path] = undefined
    if (isSuccess) {
      callback ? callback[0](res) : console.error(`${path}'s callback is undefined`)
    } else {
      callback ? callback[1](res) : console.error(`${path}'s callback is undefined`)
    }
  }

  queueSend = (data, that) => {
    this.dataQueue.push(data)
    if (!this.sendStatus && this.dataQueue.length) {
      this.sendData(that)
    }
  }

  sendData = (that) => {
    this.sendStatus = true
    clearTimeout(that.heartbeatTimer) //  如果在心跳请求等待时间内再次发送请求，则心跳请求取消
    that.timer = setTimeout( () => {
      if (this.ws.readyState === WebSocket.OPEN) {
        const data = this.dataQueue.shift()
        this.ws.send(data)
        //  发请求后准备执行心跳请求
        if (that.defaultOption.hasHeartbeat) this.heartbeat(that)
        if (this.dataQueue.length) {
          this.sendData(that)
        } else {
          this.sendStatus = false
        }
      } else if (this.ws.readyState === WebSocket.CONNECTING) {
        this.sendData(that)
      }
    }, that.defaultOption.interval)
  }

  heartbeat = (that) => {
    const { heartbeatPack, heartbeatInterval } = that.defaultOption
    that.heartbeatTimer = setTimeout( () => {
      this.ws.send(JSON.stringify(Object.assign({}, heartbeatPack, {
        id: uuid()
      })))
      this.heartbeat(that)
    }, heartbeatInterval)
  }

  constructor (option) {
    this.defaultOption = {
      url: '',
      mode: 'vague', // 可选参数 exact， vague
      timeout: 2000,
      interval: 50,
      hasHeartbeat: true,
      heartbeatInterval: 10000,
      instance: null,
      heartbeatPack: {
        lang: 'zh_cn',
        service: 'ping',
        token: ''
      },
      responseParser: function (res, next, scope) {
        const json = JSON.parse(res.data)
        const data = json.result_data
        const service = data.service
        const resultCode = json.result_code
        next(data, { service }, resultCode === 1, scope)
      },
      onClose: function () {}
    }
    this.callbackMap = {}
    this.defaultOption = Object.assign({}, this.defaultOption, option)
    this.heartbeatTimer = null
    const { instance } = this.defaultOption
    this.__Promise__ = new Promise(function (resolve, reject) {
      this.promiseCallback = { resolve, reject }
      if (!instance) {
        this.init(option)
      } else {
        this.ws = instance
      }
      this.bindEvent(this)
    }.bind(this))
  }

  init = () => {
    const { reject } = this.promiseCallback
    try {
      this.ws = new WebSocket(this.defaultOption.url)
      this.ws.timeoutInterval = this.defaultOption.timeout
      this.timeoutTimer = setTimeout(() => {
        this.ws.close()
        this.timeoutTimer = null
      }, this.defaultOption.timeout)
    } catch (err) {
      reject(err)
    }
  }

  send = (path, data) => {
    const uuidString = uuid()
    const { mode } = this.defaultOption

    if (mode === 'exact') {
      path = uuidString
    }

    return new Promise(function (resolve, reject) {
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
      this.queueSend(JSON.stringify(data), this)
    }.bind(this))
  }

  close = () => {
    // socket关闭后，将停止所有请求
    clearTimeout(this.timer)
    clearTimeout(this.heartbeatTimer)
    this.ws.close()
  }

  then = (callback) => {
    return this.__Promise__.then(function (data) {
      // eslint-disable-next-line standard/no-callback-literal
      return callback(this)
    }.bind(this))
  }

  catch = (callback) => {
    return this.__Promise__.catch(function (err) {
      return callback(err)
    })
  }

  on (name, callback) {
    if (this.watchEventList[name]) {
      this.watchEventList[name].push(callback)
    } else {
      this.watchEventList[name] = [callback]
    }
  }

  remove (name, callback) {
    const index = this.watchEventList[name].findIndex(item => {
      return item === callback
    })
    this.watchEventList.splice(index, 1)
  }

  destroy (name) {
    delete this.watchEventList[name]
  }

  updateConfig ({ heartbeatPack }) {
    this.defaultOption.heartbeatPack = heartbeatPack
  }
}
