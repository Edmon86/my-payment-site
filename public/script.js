const stripe = Stripe('pk_test_51T0TSbENSTE40GlTsyq0zYQg0ifKhqJ6hY7WYGEoT8K91R6ossCD1vUeSPwpxgG40JzvP816apQW2Lnch9JzemYd00JEutRTru')

document.addEventListener('DOMContentLoaded', () => {

  const checkboxes = document.querySelectorAll('.service')
  const totalElement = document.getElementById('total')
  const button = document.getElementById('checkout-button')
  const emailInput = document.getElementById('customerEmail')
  const emailError = document.getElementById('emailError')

  let selectedServices = []

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

      if (!session.id) {
        throw new Error('Ошибка Stripe')
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