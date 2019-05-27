'use strict';

const util = require('util');
const express = require('express');
const bodyParser = require('body-parser');
const plaid = require('plaid');
const env = require('dotenv').config().parsed;
const stripe = require('stripe')(env.STRIPE_SECRET_KEY);


// We store the access_token in memory - in production, store it in a secure
// persistent data store
var ACCESS_TOKEN = null;
var PUBLIC_TOKEN = null;
var ITEM_ID = null;
var ACCOUNT_ID = null;

// Initialize the Plaid client
// Find your API keys in the Dashboard (https://dashboard.plaid.com/account/keys)
const client = new plaid.Client(
  env.PLAID_CLIENT_ID,
  env.PLAID_SECRET,
  env.PLAID_PUBLIC_KEY,
  plaid.environments.development,
);

var app = express();
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(bodyParser.json());

// Use when testing locally
var server = app.listen(env.APP_PORT, function () {
  console.log('Server listening on port ' + env.APP_PORT);
});

var prettyPrintResponse = response => {
  console.log(util.inspect(response, {
    colors: true,
    depth: 4
  }));
};

app.get('/', function (req, res) {
  res.render('index.ejs');
});

app.get('/billing', function (request, response, next) {
  response.render('billing.ejs', {
    PLAID_PUBLIC_KEY: env.PLAID_PUBLIC_KEY,
    PLAID_ENV: env.PLAID_ENV,
  });
});

// Exchange token flow - exchange a Link public_token for
// an API access_token
// https://plaid.com/docs/#exchange-token-flow
app.post('/get_access_token', function (request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  ACCOUNT_ID = request.body.account_id;
  client.exchangePublicToken(PUBLIC_TOKEN, function (error, tokenResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    ITEM_ID = tokenResponse.item_id; // An item refers to the institution or bank

    client.createStripeToken(ACCESS_TOKEN, ACCOUNT_ID, function (err, response) {
      let bankAccountToken = response.stripe_bank_account_token;

      // This is just a sample method which successfully creates a customer
      // You can modify the fields which are stored automatically, refer to https://stripe.com/docs/api/customers/object
      stripe.customers.create({
        description: 'Customer created using Stripe + Plaid integration', // Change when you're ready
        // name: 'John Doe',
        // email: 'test@test.com',
        source: bankAccountToken // obtained with Stripe.js
      }, function (err, customer) {
        // async call
      });

    });

    prettyPrintResponse(tokenResponse);
    response.json({
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
      error: null,
    });
  });
});


// Don't need to touch
app.post('/set_access_token', function (request, response, next) {
  ACCESS_TOKEN = request.body.access_token;
  client.getItem(ACCESS_TOKEN, function (error, itemResponse) {
    response.json({
      item_id: itemResponse.item.item_id,
      error: false,
    });
  });
});