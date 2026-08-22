'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  projectId: 'overhead-office',
  appId: '1:619775654054:web:d012e08008a6e861b4dc67',
  storageBucket: 'overhead-office.firebasestorage.app',
  apiKey: 'AIzaSyA2bxXMdNsXVgPaYv3jbWJXGlosVYtBd8U',
  authDomain: 'overhead-office.firebaseapp.com',
  messagingSenderId: '619775654054',
  measurementId: 'G-DBH7BF3NYL',
}

const app = getApps().length ? getApp() : initializeApp(firebaseConfig)

export const firebaseAuth = getAuth(app)
export const firebaseDb = getFirestore(app)
