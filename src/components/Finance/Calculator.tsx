'use client';

import React, { useState, useEffect } from 'react';
import styles from './Calculator.module.css';

const Calculator = () => {
  const [price, setPrice] = useState(25000000);
  const [downPayment, setDownPayment] = useState(30); // percentage
  const [period, setPeriod] = useState(12); // months
  const [schedule, setSchedule] = useState<any[]>([]);

  const calculate = () => {
    const dpAmount = (price * downPayment) / 100;
    const remaining = price - dpAmount;
    const monthly = remaining / period;
    
    const newSchedule = [];
    for (let i = 1; i <= period; i++) {
      newSchedule.push({
        month: i,
        amount: monthly.toLocaleString() + ' ₸'
      });
    }
    setSchedule(newSchedule);
  };

  useEffect(() => {
    calculate();
  }, [price, downPayment, period]);

  return (
    <div className={styles.calculator}>
      <div className={styles.form}>
        <div className={styles.field}>
          <label>Стоимость объекта (₸)</label>
          <input 
            type="number" 
            value={price} 
            onChange={(e) => setPrice(Number(e.target.value))} 
          />
        </div>
        
        <div className={styles.field}>
          <label>Первоначальный взнос ({downPayment}%)</label>
          <input 
            type="range" 
            min="10" 
            max="90" 
            step="5"
            value={downPayment} 
            onChange={(e) => setDownPayment(Number(e.target.value))} 
          />
        </div>

        <div className={styles.field}>
          <label>Срок рассрочки ({period} мес.)</label>
          <input 
            type="range" 
            min="3" 
            max="36" 
            step="3"
            value={period} 
            onChange={(e) => setPeriod(Number(e.target.value))} 
          />
        </div>
      </div>

      <div className={styles.results}>
        <div className={styles.resultItem}>
          <span className={styles.resultLabel}>Сумма взноса:</span>
          <span className={styles.resultValue}>{((price * downPayment) / 100).toLocaleString()} ₸</span>
        </div>
        <div className={styles.resultItem}>
          <span className={styles.resultLabel}>Ежемесячный платеж:</span>
          <span className={`${styles.resultValue} styles.highlight`}>
            {((price - (price * downPayment) / 100) / period).toLocaleString()} ₸
          </span>
        </div>
      </div>

      <div className={styles.schedule}>
        <h4>График платежей</h4>
        <div className={styles.scrollArea}>
          {schedule.map((item) => (
            <div key={item.month} className={styles.scheduleItem}>
              <span>Месяц {item.month}</span>
              <strong>{item.amount}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Calculator;
