// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDAna8soZWo5bFD-nSEFUdSTEQrVyqE-_E",
  authDomain: "cyberdetox-58b3b.firebaseapp.com",
  projectId: "cyberdetox-58b3b",
  storageBucket: "cyberdetox-58b3b.firebasestorage.app",
  messagingSenderId: "172663128582",
  appId: "1:172663128582:web:ae1ba7c31e88b6db863987",
  measurementId: "G-FDPG29SBXM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { db };