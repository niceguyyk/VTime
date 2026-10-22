import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { ConverterApp } from './converter-app';

createRoot(document.getElementById('root')!).render(<React.StrictMode><ConverterApp /></React.StrictMode>);
