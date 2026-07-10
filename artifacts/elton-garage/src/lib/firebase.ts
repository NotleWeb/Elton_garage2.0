import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyA5-bjf4mXOWnoxOgRhBuVdscVgtYEytk4',
  authDomain: 'eltongarage-8d221.firebaseapp.com',
  projectId: 'eltongarage-8d221',
  storageBucket: 'eltongarage-8d221.appspot.com',
  messagingSenderId: '555150567501',
  appId: '1:555150567501:web:f1f143ab2ab30a44c39404'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
