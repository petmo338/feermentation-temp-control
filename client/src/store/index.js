/* eslint-disable no-console */
import Vue from 'vue'
import Vuex from 'vuex'
import http from 'http'

Vue.use(Vuex)

const store = new Vuex.Store({
  state: {
    currentTemp: 123,
    setpoint: 30,
    newTemp: 0
  },
  mutations: {
    setTemp (state, temp) {
      state.setpoint = temp
    },
    currTemp (state, temp) {
      state.currentTemp = temp
    }
  },
  actions: {
    getTemp ({ commit}) {
      const options = {
        hostname: '172.16.200.200',
        port: 9000,
        path: '/currentTemp',
        method: 'GET',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': '*'
        }
      }
      
      const req = http.request(options, res => {
        console.log(`statusCode: ${res.statusCode}`)
        console.log(res)
        res.on('data', d => {
          console.log(JSON.parse(d))
          let temp = parseFloat(JSON.parse(d).currentTemp1)
          if (!isNaN(temp)) {
            commit('currTemp', temp)
          } else {
            console.error('Unparseable float: ' + d.currentTemp1)
          }
        })
      })
      
      req.on('error', error => {
        console.error(error)
      })
      
      req.end()
    }
  },
  modules: {
  }
})

export default store

// setInterval(function () {
//   store.commit('currTemp', store.state.setpoint -0.5 + Math.random())
// }, 250)
setInterval(function () {
  store.dispatch('getTemp')
}, 2000)
