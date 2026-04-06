require('dotenv').config()
const express = require('express')
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const fs = require('fs')
const path = require('path')
const nodemailer = require('nodemailer')

const app = express()
const PORT = process.env.PORT || 3000

/* ========================
   БАЗА УСЛУГ
======================== */
const SERVICES = {
  site: { name: 'Разработка сайта', price: 1500 },
  ads: { name: 'Настройка рекламы', price: 800 },
  logo: { name: 'Дизайн логотипа', price: 500 },
}

/* ========================
   WEBHOOK
======================== */
app.post('/webhook', express.raw({ type: 'application/json' }), (req, res) => {
  const sig = req.headers['stripe-signature']
  let event

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    console.error('❌ Webhook ошибка:', err.message)
    return res.sendStatus(400)
  }

  if (event.type === 'checkout.session.completed') {
    console.log('🔥 WEBHOOK СРАБОТАЛ')

    const session = event.data.object
    const services = JSON.parse(session.metadata?.services || '[]')

    const order = {
      id: session.id,
      email: session.customer_details?.email || session.customer_email || null,
      amount: session.amount_total / 100,
      currency: session.currency,
      status: session.payment_status,
      services,
      created: new Date().toISOString(),
    }

    console.log('📦 Заказ:', order)

    // Создаем папку data, если не существует
    const dataDir = path.join(__dirname, 'data')
    if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir)

    // 📁 Сохранение заказа
    const ordersFile = path.join(dataDir, 'orders.json')
    let orders = []
    if (fs.existsSync(ordersFile)) {
      orders = JSON.parse(fs.readFileSync(ordersFile))
    }
    orders.push(order)
    fs.writeFileSync(ordersFile, JSON.stringify(orders, null, 2))
    console.log('✅ Заказ сохранён')

    // ========================
    // EMAIL (Надежное подключение)
    // ========================
    if (order.email) {
      console.log('🚀 Начинаем отправку email...')

      const transporter = nodemailer.createTransport({
        host: 'smtp.mail.ru',
        port: 587,       // STARTTLS
        secure: false,   // false для TLS
        auth: {
          user: process.env.MAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
        tls: {
          rejectUnauthorized: false, // для Render
        },
      })

      const message = {
        from: process.env.MAIL_USER,
        to: order.email,
        subject: 'Ваш заказ успешно оплачен ✅',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #ddd; border-radius: 10px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #1f1c2c, #928dab); color: white; padding: 20px; text-align: center;">
              <h1 style="margin: 0;">Спасибо за заказ!</h1>
            </div>
            <div style="padding: 20px;">
              <p>Здравствуйте 👋</p>
              <p>Ваш заказ <b>№${order.id}</b> успешно оплачен.</p>
              <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <thead>
                  <tr style="background-color: #f2f2f2;">
                    <th style="padding: 10px; text-align: left;">Услуга</th>
                    <th style="padding: 10px; text-align: right;">Цена</th>
                  </tr>
                </thead>
                <tbody>
                  ${services.map(s => `
                    <tr>
                      <td style="padding: 10px;">${s.name}</td>
                      <td style="padding: 10px; text-align: right;">${s.price} ₽</td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr style="border-top: 2px solid #ddd; font-weight: bold;">
                    <td style="padding: 10px;">Итого</td>
                    <td style="padding: 10px; text-align: right;">${order.amount} ₽</td>
                  </tr>
                </tfoot>
              </table>
              <div style="text-align: center; margin: 25px 0;">
                <a href="https://my-payment-site-1.onrender.com" style="background: #ff6a00; color: white; padding: 12px 25px; text-decoration: none; border-radius: 6px;">
                  Перейти на сайт
                </a>
              </div>
              <p style="font-size: 14px; color: #666;">
                Мы уже начали работу над вашим заказом 🚀
              </p>
            </div>
            <div style="background: #f2f2f2; padding: 15px; text-align: center; font-size: 12px;">
              Это письмо отправлено автоматически.<br>
              © 2026 Ваш сервис
            </div>
          </div>
        `,
      }

      transporter.sendMail(message)
        .then(info => console.log('✅ Email успешно отправлен! Ответ:', info.response))
        .catch(err => console.error('❌ Ошибка отправки email:', err))
    }
  }

  res.json({ received: true })
})

/* ========================
   MIDDLEWARE
======================== */
app.use(express.static('public'))
app.use(express.json())

/* ========================
   CREATE CHECKOUT
======================== */
app.post('/create-checkout-session', async(req, res) => {
  const { services, email } = req.body
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Неверный email' })
  }
  try {
    const lineItems = services.map(id => ({
      price_data: {
        currency: 'rub',
        product_data: { name: SERVICES[id].name },
        unit_amount: SERVICES[id].price * 100,
      },
      quantity: 1,
    }))
    const servicesForSave = services.map(id => SERVICES[id])
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
      customer_email: email,
      metadata: { services: JSON.stringify(servicesForSave) },
      success_url: 'https://my-payment-site-1.onrender.com/success.html',
      cancel_url: 'https://my-payment-site-1.onrender.com/cancel.html',
    })
    res.json({ id: session.id })
  } catch (err) {
    console.error('❌ Stripe ошибка:', err.message)
    res.status(500).json({ error: err.message })
  }
})

/* ========================
   SERVER
======================== */
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`))