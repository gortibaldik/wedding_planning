<script setup lang="ts">
import SailingGame from './sailing/SailingGame.vue'
</script>

<template>
  <div class="games-wrap">
    <a class="games-back" href="/">← zpět</a>
    <h1 class="games-title">Games</h1>

    <section class="game-card">
      <h2 class="game-card-title">Jachting</h2>
      <SailingGame />
    </section>
  </div>
</template>

<style scoped>
.games-wrap {
  max-width: 720px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 32px;
}
.games-back {
  display: inline-block;
  text-decoration: none;
  color: inherit;
  font-size: 0.95rem;
  opacity: 0.7;
}
.games-back:hover {
  opacity: 1;
}
.games-title {
  font-family: 'Great Vibes', cursive;
  font-size: 3rem;
  text-align: center;
}
.game-card {
  border: 1px solid rgba(0, 0, 0, 0.12);
  border-radius: 12px;
  padding: 20px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
.game-card-title {
  font-size: 1.25rem;
  margin-bottom: 12px;
  text-align: center;
}
</style>
