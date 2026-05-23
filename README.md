# My Payment Site

![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?style=for-the-badge&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express-5.x-000000?style=for-the-badge&logo=express&logoColor=white)
![Stripe](https://img.shields.io/badge/Stripe-Checkout-635BFF?style=for-the-badge&logo=stripe&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-Email-000000?style=for-the-badge)
![ESLint](https://img.shields.io/badge/ESLint-10.x-4B32C3?style=for-the-badge&logo=eslint&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES2023-F7DF1E?style=for-the-badge&logo=javascript&logoColor=000)
![Bootstrap](https://img.shields.io/badge/Bootstrap-5.3-7952B3?style=for-the-badge&logo=bootstrap&logoColor=white)
![dotenv](https://img.shields.io/badge/dotenv-config-ECD53F?style=for-the-badge)
![Nodemon](https://img.shields.io/badge/Nodemon-dev-76D04B?style=for-the-badge&logo=nodemon&logoColor=white)
![Status](https://img.shields.io/badge/Status-active-success?style=for-the-badge)
![License](https://img.shields.io/badge/License-ISC-blue?style=for-the-badge)

Простой сайт для онлайн-оплаты цифровых услуг через Stripe. Пользователь выбирает услуги, указывает email и переходит на защищенную страницу оплаты. После успешной оплаты заказ сохраняется, а клиент получает email-подтверждение.

## Возможности

- выбор нескольких услуг перед оплатой;
- автоматический подсчет итоговой суммы;
- проверка email на клиенте и сервере;
- создание Stripe Checkout Session;
- обработка Stripe webhook после оплаты;
- сохранение заказов в `data/orders.json`;
- отправка email-подтверждения через Resend;
- защищенная админ-панель с Basic Auth;
- фильтрация заказов по email и дате.

## Стек

- Node.js
- Express
- Stripe
- Resend
- Bootstrap
- HTML, CSS, JavaScript

## Запуск локально

```bash
npm install
npm start
```

Для разработки с автоматическим перезапуском:

```bash
npm run dev
```

После запуска сайт будет доступен по адресу:

```text
http://localhost:3000
```

## Переменные окружения

Создайте файл `.env` в корне проекта и добавьте значения:

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
RESEND_API_KEY=re_...
EMAIL_FROM=you@example.com
ADMIN_LOGIN=admin
ADMIN_PASSWORD=password
PORT=3000
```

## Основные страницы

- `/` - страница выбора услуг и оплаты;
- `/success.html` - успешная оплата;
- `/cancel.html` - отмененная оплата;
- `/admin.html` - админ-панель;
- `/admin` - API со списком заказов, защищено Basic Auth.

## Webhook Stripe

Для локальной проверки webhook можно использовать Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/webhook
```

Полученный `whsec_...` нужно указать в `STRIPE_WEBHOOK_SECRET`.

## Описание для GitHub

Payment page for digital services with Stripe Checkout, email confirmation via Resend, webhook order saving, and a protected admin panel.
