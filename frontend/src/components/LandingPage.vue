<script setup>
import { ref } from 'vue'
import mainBg from '@/assets/login-bg.png'
import kackyImg from '@/assets/kacicky.png'

const adminOpen = ref(false)

const login = () => {
  if (import.meta.env.VITE_ENABLE_LOCAL_AUTH === 'true') {
    const username = prompt('Meno')
    if (username) {
      window.location.href = `/auth/local?username=${encodeURIComponent(username)}`
    }
  } else {
    window.location.href = '/auth/google'
  }
}
</script>

<template>
  <div class="main-screen" :style="{ backgroundImage: `url(${mainBg})` }">
    <h1 class="wedding-title">
      <span>Eugenie</span>
      <span class="wedding-title-amp">a</span>
      <span>Frantisek</span>
    </h1>
    <h2 class="wedding-date">
      <span>se vezmou</span>
      <span>10. ŘÍJNA 2026</span>
    </h2>
    <img :src="kackyImg" alt="" class="kacky-img" />
    <div class="sections">
      <div class="section-divider"><span>🪶</span></div>
      <div class="section">
        <h3 class="section-title">ZÁKLADNÍ INFORMACE</h3>
        <div class="section-body">
          <div class="info-grid">
            <span class="info-label">Obřad</span>
            <span class="info-value">od 14:15 v Botanické záhradě v Košicích</span>
            <span class="info-label">Hostina</span>
            <span class="info-value">od 16:00 v Sále Bačíkova v Košicích</span>
          </div>
        </div>
      </div>
      <div class="section-divider"><span>🪶</span></div>
      <div class="section">
        <h3 class="section-title">DOTAZNÍKY</h3>
        <div class="section-body">
          <p class="section-text">Dotazníky se připravují</p>
        </div>
      </div>
      <div class="section-divider"><span>🪶</span></div>
      <div class="section">
        <h3 class="section-title">FAQ</h3>
        <div class="section-body">
          <p class="section-text">Připravujeme</p>
        </div>
      </div>
    </div>
    <div class="admin-section">
      <div class="admin-header" @click="adminOpen = !adminOpen">
        <span class="admin-title">Admin sekce</span>
        <button class="admin-toggle">{{ adminOpen ? '▼' : '▲' }}</button>
      </div>
      <div v-if="adminOpen" class="admin-content">
        <button class="login-btn admin-login-btn" @click="login">Prihlásiť sa</button>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
$color-pink: #ac2746;
$color-green-dark: #495c23;
$color-green: #839e37;
$color-green-light: #cfdaae;
$color-white-overlay: rgba(255, 255, 255, 0.5);

@font-face {
  font-family: 'Sisterhood';
  src: url('@/assets/fonts/Sisterhood.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

@font-face {
  font-family: 'Carelia-Upright';
  src: url('@/assets/fonts/Carelia-Upright.ttf') format('truetype');
  font-weight: normal;
  font-style: normal;
}

.main-screen {
  width: 100vw;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding-top: 3rem;
  padding-bottom: 0;
  background-size: cover;
  background-position: center;
  background-repeat: repeat;
}

.wedding-title {
  font-family: 'Sisterhood', serif;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  gap: 2rem;
  font-size: 6rem;
  color: $color-pink;
  font-weight: 600;
  text-align: center;
  width: 100%;
  margin-top: 2rem;

  &-amp {
    font-size: 3rem;
  }

  @media (max-width: 640px) {
    gap: 1.5rem;
    font-size: 3rem;
    margin-top: 0.5rem;

    &-amp {
      font-size: 2rem;
    }
  }
}

.wedding-date {
  font-family: 'Carelia-Upright', serif;
  font-size: 1.5rem;
  color: $color-pink;
  font-weight: 400;
  text-align: center;
  margin-top: 3rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  @media (max-width: 640px) {
    font-size: 1.1rem;
    margin-top: 1rem;
  }
}

.kacky-img {
  max-width: 60rem;
  width: 100%;
}

.sections {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 50rem;
  padding: 0 2rem;

  @media (max-width: 640px) {
    padding: 0 1rem;
  }
}

.section-divider {
  display: flex;
  align-items: center;
  width: 100%;
  gap: 1rem;
  margin: 0;

  &::before,
  &::after {
    content: '';
    flex: 1;
    height: 1px;
    background-color: $color-green-dark;
    opacity: 0.4;
  }

  span {
    font-size: 1.2rem;
  }
}

.section {
  width: 100%;
  padding: 0 2rem 1.5rem;

  .section-title {
    font-family: 'Carelia-Upright', serif;
    font-size: 1.4rem;
    color: $color-green-dark;
    font-weight: 400;
    text-align: center;
    margin-bottom: 1rem;
    padding: 0.2rem 2rem 0.5rem;
  }

  .section-body {
    display: flex;
    justify-content: center;

    .section-text {
      color: $color-green-dark;
      font-size: 1rem;
      text-align: center;
      margin: 0;
    }
  }

  @media (max-width: 640px) {
    .section-title {
      font-size: 1.1rem;
    }
  }
}

.info-grid {
  display: grid;
  grid-template-columns: auto auto;
  column-gap: 1.5rem;
  row-gap: 0.4rem;

  .info-label {
    color: $color-green-dark;
    font-size: 1rem;
    text-align: right;
    font-weight: 600;
  }

  .info-value {
    color: $color-green-dark;
    font-size: 1rem;
    text-align: left;
  }
}

.admin-section {
  margin-top: auto;
  width: 100%;

  .admin-header {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    padding: 0.5rem 1.5rem;
    cursor: pointer;
    background-color: $color-white-overlay;

    .admin-title {
      font-family: 'Carelia-Upright', serif;
      font-size: 1rem;
      color: $color-green-dark;
    }

    .admin-toggle {
      background: none;
      border: none;
      font-size: 0.8rem;
      color: $color-green-dark;
      cursor: pointer;
    }
  }

  .admin-content {
    display: flex;
    justify-content: center;
    padding: 1.5rem;
    background-color: $color-white-overlay;
    border-radius: 0;

    .admin-login-btn {
      padding: 12px 32px;
      background: $color-green;
      color: $color-green-light;
      border: 1px solid $color-green-dark;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        opacity: 0.85;
        background: $color-green-light;
        color: $color-green-dark;
        transform: translateY(-2px);
      }

      &:active {
        transform: translateY(0);
      }
    }
  }

  @media (max-width: 640px) {
    .admin-header {
      justify-content: center;
    }
  }
}
</style>
