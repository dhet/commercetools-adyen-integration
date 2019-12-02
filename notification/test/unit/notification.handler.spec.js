const sinon = require('sinon')
const { expect } = require('chai')
const { cloneDeep } = require('lodash')
const notificationHandler = require('../../src/handler/notification/notification.handler')
const notificationsMock = require('../resources/notification').notificationItems
const concurrentModificationError = require('../resources/concurrent-modification-exception')
const ctpClientMock = require('./ctp-client-mock')
const paymentMock = require('../resources/payment-credit-card')

const sandbox = sinon.createSandbox()

const config = {
  ctp: {
    projectKey: 'test',
    clientId: 'test',
    clientSecret: 'test'
  }
}

describe('notification module', () => {
  afterEach(() => sandbox.restore())

  it(`given that ADYEN sends an AUTHORISATION is success notification
      when payment has an pending authorization transaction 
      then notification module should add notification to the interface interaction 
      and should update pending authorization state to the success`, async () => {
    // prepare data
    const notifications = [{
      NotificationRequestItem: {
        amount: {
          currency: "EUR",
          value: 10100
        },
        eventCode: "AUTHORISATION",
        eventDate: "2019-01-30T18:16:22+01:00",
        merchantAccountCode: "CommercetoolsGmbHDE775",
        merchantReference: "8313842560770001",
        operations: [
          "CANCEL",
          "CAPTURE",
          "REFUND"
        ],
        paymentMethod: "visa",
        pspReference: "test_AUTHORISATION_1",
        success: "true"
      }
    }]
    const payment = cloneDeep(paymentMock)
    payment.transactions.push({
      id: "9ca92d05-ba63-47dc-8f83-95b08d539646",
      type: "Authorization",
      amount: {
        type: "centPrecision",
        currencyCode: "EUR",
        centAmount: 495,
        fractionDigits: 2
      },
      state: "Initial"
    })
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [payment]
      }
    }))
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')
    // process
    await notificationHandler.processNotifications(notifications, ctpClient)
    const expectedUpdateActions = [
      {
        action: 'addInterfaceInteraction',
        type: {
          key: 'ctp-adyen-integration-interaction-notification',
          typeId: 'type'
        },
        fields: {
          status: 'AUTHORISATION',
          notification: JSON.stringify(notifications[0])
        }
      },
      {
        action: "changeTransactionState",
        state: "Success",
        transactionId: "9ca92d05-ba63-47dc-8f83-95b08d539646"
      }
    ]

    //assert update actions
    // createdAt is set to the current date during the update action calculation
    // We can't know what is set there
    expect(ctpClientUpdateSpy.args[0][3][0].fields.createdAt).to.exist
    const actualUpdateActionsWithoutCreatedAt = ctpClientUpdateSpy.args[0][3]
    delete actualUpdateActionsWithoutCreatedAt[0].fields.createdAt
    expect(actualUpdateActionsWithoutCreatedAt).to.deep.equal(expectedUpdateActions)
  })

  it(`given that ADYEN sends an AUTHORISATION is not successful notification
      when payment has an pending authorization transaction 
      then notification module should add notification to the interface interaction 
      and should not update the pending transaction `, async () => {
    // prepare data
    const notifications = [{
      NotificationRequestItem: {
        amount: {
          currency: "EUR",
          value: 10100
        },
        eventCode: "AUTHORISATION",
        eventDate: "2019-01-30T18:16:22+01:00",
        merchantAccountCode: "CommercetoolsGmbHDE775",
        merchantReference: "8313842560770001",
        operations: [
          "CANCEL",
          "CAPTURE",
          "REFUND"
        ],
        paymentMethod: "visa",
        pspReference: "test_AUTHORISATION_1",
        success: "false"
      }
    }]
    const payment = cloneDeep(paymentMock)
    payment.transactions.push({
      id: "9ca92d05-ba63-47dc-8f83-95b08d539646",
      type: "Authorization",
      amount: {
        type: "centPrecision",
        currencyCode: "EUR",
        centAmount: 495,
        fractionDigits: 2
      },
      state: "Pending"
    })
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [payment]
      }
    }))
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')
    // process
    await notificationHandler.processNotifications(notifications, ctpClient)
    const expectedUpdateActions = [
      {
        action: 'addInterfaceInteraction',
        type: {
          key: 'ctp-adyen-integration-interaction-notification',
          typeId: 'type'
        },
        fields: {
          status: 'AUTHORISATION',
          notification: JSON.stringify(notifications[0])
        }
      }
    ]

    //assert update actions
    // createdAt is set to the current date during the update action calculation
    // We can't know what is set there
    expect(ctpClientUpdateSpy.args[0][3][0].fields.createdAt).to.exist
    const actualUpdateActionsWithoutCreatedAt = ctpClientUpdateSpy.args[0][3]
    delete actualUpdateActionsWithoutCreatedAt[0].fields.createdAt
    expect(actualUpdateActionsWithoutCreatedAt).to.deep.equal(expectedUpdateActions)
  })

  it(`given that ADYEN sends an AUTHORISATION is success notification
      when payment has an success authorization transaction 
      and has already has the same notification saved in interface interaction
      then should not update interface interaction and transaction`, async () => {
    // prepare data
    const notifications = [{
      NotificationRequestItem: {
        amount: {
          currency: "EUR",
          value: 10100
        },
        eventCode: "AUTHORISATION",
        eventDate: "2019-01-30T18:16:22+01:00",
        merchantAccountCode: "CommercetoolsGmbHDE775",
        merchantReference: "8313842560770001",
        operations: [
          "CANCEL",
          "CAPTURE",
          "REFUND"
        ],
        paymentMethod: "visa",
        pspReference: "test_AUTHORISATION_1",
        success: "true"
      }
    }]
    const payment = cloneDeep(paymentMock)
    payment.transactions.push({
      id: "9ca92d05-ba63-47dc-8f83-95b08d539646",
      type: "Authorization",
      amount: {
        type: "centPrecision",
        currencyCode: "EUR",
        centAmount: 495,
        fractionDigits: 2
      },
      state: "Success"
    })
    payment.interfaceInteractions.push({
      type: {
        typeId: 'type',
        id: '3fd15a04-b460-4a88-a911-0472c4c080b3'
      },
      fields: {
        notification: JSON.stringify(notifications[0]),
        status: 'SUCCESS',
        createdAt: '2019-02-05T12:29:36.028Z'
      }
    })
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [payment]
      }
    }))
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')
    // process
    await notificationHandler.processNotifications(notifications, ctpClient)
    // assert
    expect(ctpClientUpdateSpy.args[0][3]).to.have.lengthOf(0)
  })

  it(`given that ADYEN sends a CANCELLATION notification
      when payment has an pending authorization transaction 
      then notification module should add notification to the interface interaction 
      and should add additional CancelAuthorization transaction`, async () => {
    // prepare data
    const notifications = [{
      NotificationRequestItem: {
        amount: {
          currency: "EUR",
          value: 10100
        },
        eventCode: "CANCELLATION",
        eventDate: "2019-01-30T18:16:22+01:00",
        merchantAccountCode: "CommercetoolsGmbHDE775",
        merchantReference: "8313842560770001",
        operations: [
          "CANCEL",
          "CAPTURE",
          "REFUND"
        ],
        paymentMethod: "visa",
        pspReference: "test_AUTHORISATION_1",
        success: "true"
      }
    }]
    const payment = cloneDeep(paymentMock)
    payment.transactions.push({
      id: "9ca92d05-ba63-47dc-8f83-95b08d539646",
      type: "Authorization",
      amount: {
        type: "centPrecision",
        currencyCode: "EUR",
        centAmount: 495,
        fractionDigits: 2
      },
      state: "Pending"
    })
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [payment]
      }
    }))
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')
    // process
    await notificationHandler.processNotifications(notifications, ctpClient)
    const expectedUpdateActions = [
      {
        action: 'addInterfaceInteraction',
        type: {
          key: 'ctp-adyen-integration-interaction-notification',
          typeId: 'type'
        },
        fields: {
          status: 'CANCELLATION',
          notification: JSON.stringify(notifications[0])
        }
      },
      {
        action: "addTransaction",
        transaction: {
          amount: {
            centAmount: 10100,
            currencyCode: "EUR"
          },
          state: "Success",
          type: "CancelAuthorization"
        }
      }
    ]

    //assert update actions
    // createdAt is set to the current date during the update action calculation
    // We can't know what is set there
    expect(ctpClientUpdateSpy.args[0][3][0].fields.createdAt).to.exist
    const actualUpdateActionsWithoutCreatedAt = ctpClientUpdateSpy.args[0][3]
    delete actualUpdateActionsWithoutCreatedAt[0].fields.createdAt
    expect(actualUpdateActionsWithoutCreatedAt).to.deep.equal(expectedUpdateActions)
  })

  xit('should update transaction with a new state', async () => {
    const modifiedPaymentMock = cloneDeep(paymentMock)
    const notificationsMockClone = cloneDeep(notificationsMock)
    notificationsMockClone[0].NotificationRequestItem.eventCode = 'CAPTURE'
    notificationsMockClone[0].NotificationRequestItem.success = 'false'
    modifiedPaymentMock.interfaceInteractions.push({
      type: {
        typeId: 'type',
        id: '3fd15a04-b460-4a88-a911-0472c4c080b3'
      },
      fields: {
        createdAt: '2019-02-05T12:29:36.028Z',
        notification: JSON.stringify(notificationsMockClone[0]),
        status: 'SUCCESS'
      }
    })
    modifiedPaymentMock.transactions[0].state = 'Success'
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [modifiedPaymentMock]
      }
    }))
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')


    await notificationHandler.processNotifications(notificationsMockClone, ctpClient)
    const expectedUpdateActions = [
      {
        action: "addTransaction",
        transaction: {
          amount: {
            centAmount: 10100,
            currencyCode: "EUR"
          },
          state: "Failure",
          type: "Charge"
        }
      }
    ]

    expect(ctpClientUpdateSpy.args[0][3]).to.deep.equal(expectedUpdateActions)
  })

  it('should repeat on concurrent modification errors ', async () => {
    const modifiedPaymentMock = cloneDeep(paymentMock)
    modifiedPaymentMock.interfaceInteractions.push({
      type: {
        typeId: 'type',
        id: '3fd15a04-b460-4a88-a911-0472c4c080b3'
      },
      fields: {
        createdAt: '2019-02-05T12:29:36.028Z',
        notification: JSON.stringify(notificationsMock[0]),
        status: 'SUCCESS'
      }
    })
    const ctpClient = ctpClientMock.get(config)
    sandbox.stub(ctpClient, 'fetch').callsFake(() => ({
      body: {
        results: [modifiedPaymentMock]
      }
    }))
    sandbox.stub(ctpClient, 'fetchById').callsFake(() => ({
      body: {
        results: [modifiedPaymentMock]
      }
    }))
    const ctpClientUpdateSpy = sandbox.stub(ctpClient, 'update').callsFake(() => {
      throw concurrentModificationError
    })
    try {
      await notificationHandler.processNotifications(notificationsMock, ctpClient)
      // eslint-disable-next-line no-empty
    } catch (e) {
      // we check retry logic here and it should throw after certain amount
      // of retries. So the error is expected
    }
    expect(ctpClientUpdateSpy.callCount).to.equal(21)
  })

  it('do not make any requests when merchantReference cannot be extracted from notification', async () => {
    const ctpClient = ctpClientMock.get(config)
    const ctpClientFetchSpy = sandbox.spy(ctpClient, 'fetch')
    const ctpClientFetchByIdSpy = sandbox.spy(ctpClient, 'fetchById')
    const ctpClientUpdateSpy = sandbox.spy(ctpClient, 'update')
    await notificationHandler.processNotifications([{ name: 'some wrong notification' }], ctpClient)

    expect(ctpClientFetchSpy.callCount).to.equal(0)
    expect(ctpClientFetchByIdSpy.callCount).to.equal(0)
    expect(ctpClientUpdateSpy.callCount).to.equal(0)
  })
})
