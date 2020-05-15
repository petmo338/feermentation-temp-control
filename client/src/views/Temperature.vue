<template>
  <div class="home">
    <!-- <img alt="Vue logo" src="../assets/logo.png"> -->
    <temperature msg="Welcome to Your Vue.js App --- blähuuu"/>
  </div>
</template>

<script>
// @ is an alias to /src
import temperature from '@/components/temperature.vue'

export default {
  name: 'Temperature',
  components: {
    temperature
  }
}
</script>
