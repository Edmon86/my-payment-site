document.addEventListener('DOMContentLoaded', async() => {

  const checkboxes = document.querySelectorAll('.service')
  const totalElement = document.getElementById('total')
  const button = document.getElementById('checkout-button')
  const emailInput = document.getElementById('customerEmail')
  const emailError = document.getElementById('emailError')

  let selectedServices = []
  let stripe

  try {
    const res = await fetch('/config')
    const config = await res.json()

    if (!config.stripePublishableKey) {
      throw new Error('Stripe publishable key is missing')
    }

    stripe = Stripe(config.stripePublishableKey)
  } catch (err) {
    console.error(err)
    button.textContent = 'Оплата временно недоступна'
    button.disabled = true
    return
  }

  function updateUI() {
    let total = 0
    selectedServices = []

    checkboxes.forEach(cb => {
      if (cb.checked) {
        total += parseInt(cb.dataset.price)
        selectedServices.push(cb.dataset.id) // 🔥 ВАЖНО
      }
    })

    totalElement.textContent = total

    // активируем кнопку если есть услуги
    button.disabled = selectedServices.length === 0
  }

  checkboxes.forEach(cb => {
    cb.addEventListener('change', updateUI)
  })

  // LIVE проверка email
  emailInput.addEventListener('input', () => {

    const email = emailInput.value.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    emailInput.classList.remove('input-error', 'input-success')
    emailError.classList.remove('show')

    if (email && emailRegex.test(email)) {
      emailInput.classList.add('input-success')
    }
  })

  button.addEventListener('click', async() => {

    const email = emailInput.value.trim()
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    // сброс
    emailInput.classList.remove('input-error', 'input-success')
    emailError.classList.remove('show')

    // проверка email
    if (!email) {
      emailError.textContent = 'Введите email'
      emailError.classList.add('show')
      emailInput.classList.add('input-error')
      return
    }

    if (!emailRegex.test(email)) {
      emailError.textContent = 'Введите корректный email'
      emailError.classList.add('show')
      emailInput.classList.add('input-error')
      return
    }

    // успех
    emailInput.classList.add('input-success')

    button.disabled = true
    button.textContent = 'Переход...'

    try {

      const res = await fetch('/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          services: selectedServices,
          email: email,
        }),
      })

      const session = await res.json()

      if (!res.ok || !session.id) {
        throw new Error(session.error || 'Ошибка Stripe')
      }

      await stripe.redirectToCheckout({
        sessionId: session.id,
      })

    } catch (err) {
      console.error(err)
      alert('Ошибка оплаты')
      button.disabled = false
      button.textContent = 'Перейти к оплате'
    }

  })

})
