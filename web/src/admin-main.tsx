import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { AdminApp } from './admin-app';

createRoot(document.getElementById('root')!).render(<React.StrictMode><AdminApp /></React.StrictMode>);
