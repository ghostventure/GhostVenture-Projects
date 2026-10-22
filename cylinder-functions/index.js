const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getAuth } = require('firebase-admin/auth')
const { getFirestore, FieldValue } = require('firebase-admin/firestore')
const { createCylinderHandler } = require('./cylinder-control.cjs')

initializeApp()
exports.cylinderApi = createCylinderHandler({ auth: getAuth(), db: getFirestore(), fieldValue: FieldValue, onRequest })