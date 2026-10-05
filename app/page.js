"use client";

import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { 
  LayoutDashboard, 
  LogOut, 
  CreditCard, 
  AlertCircle,
  CheckCircle2,
  Calendar,
  DollarSign
} from 'lucide-react';

// Seeded Data
const SEEDED_LOANS = [
  {
    id: "LN-1001",
    totalAmount: 50000,
    outstanding: 35000,
    overdue: 1500,
    interestRate: 5.5,
    schedule: [
      { id: 1, dueDate: "2023-08-01", amount: 1500, status: "Paid" },
      { id: 2, dueDate: "2023-09-01", amount: 1500, status: "Overdue" },
      { id: 3, dueDate: "2023-10-01", amount: 1500, status: "Pending" },
      { id: 4, dueDate: "2023-11-01", amount: 1500, status: "Pending" }
    ]
  },
  {
    id: "LN-1002",
    totalAmount: 15000,
    outstanding: 15000,
    overdue: 0,
    interestRate: 7.2,
    schedule: [
      { id: 1, dueDate: "2023-10-15", amount: 1200, status: "Pending" },
      { id: 2, dueDate: "2023-11-15", amount: 1200, status: "Pending" },
    ]
  }
];

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  // Dashboard State
  const [loans, setLoans] = useState(SEEDED_LOANS);
  const [selectedLoanId, setSelectedLoanId] = useState(SEEDED_LOANS[0].id);
  
  // Payment Form State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(null); // 'loading', 'success', 'error'
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      setAuthError('Failed to login. Please check your credentials.');
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      setAuthError('Google login failed.');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) return;
    
    setPaymentStatus('loading');
    
    try {
      const token = await user.getIdToken();
      const idempotencyKey = uuidv4();
      
      // Simulate API Call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Optional: actually make the request
      // const res = await fetch('/api/payments', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`,
      //     'Idempotency-Key': idempotencyKey
      //   },
      //   body: JSON.stringify({
      //     loanId: selectedLoanId,
      //     amount: Number(paymentAmount)
      //   })
      // });
      
      // Local State Update
      setLoans(prevLoans => prevLoans.map(loan => {
        if (loan.id === selectedLoanId) {
          const paidAmount = Number(paymentAmount);
          const newOverdue = Math.max(0, loan.overdue - paidAmount);
          const newOutstanding = Math.max(0, loan.outstanding - paidAmount);
          
          let remainingToApply = paidAmount;
          const newSchedule = loan.schedule.map(payment => {
            if (payment.status === 'Overdue' && remainingToApply > 0) {
              if (remainingToApply >= payment.amount) {
                remainingToApply -= payment.amount;
                return { ...payment, status: 'Paid' };
              } else {
                remainingToApply = 0;
                return { ...payment, amount: payment.amount - remainingToApply }; // Simplistic update
              }
            }
            return payment;
          });

          return {
            ...loan,
            outstanding: newOutstanding,
            overdue: newOverdue,
            schedule: newSchedule
          };
        }
        return loan;
      }));
      
      setPaymentStatus('success');
      setPaymentAmount('');
      
      setTimeout(() => {
        setPaymentStatus(null);
      }, 3000);
      
    } catch (error) {
      console.error(error);
      setPaymentStatus('error');
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-xl shadow-sm border border-gray-100 p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Vitto Loan Service</h1>
            <p className="text-sm text-gray-500 mt-2">Sign in to manage your repayments</p>
          </div>
          
          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-md flex items-center">
              <AlertCircle className="w-4 h-4 mr-2" />
              {authError}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <button
              type="submit"
              className="w-full bg-gray-900 text-white rounded-md py-2 text-sm font-medium hover:bg-gray-800 transition-colors"
            >
              Sign In
            </button>
          </form>

          <div className="mt-6 relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <button
            onClick={handleGoogleLogin}
            className="mt-6 w-full flex items-center justify-center bg-white border border-gray-300 text-gray-700 rounded-md py-2 text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Google
          </button>
        </div>
      </div>
    );
  }

  const selectedLoan = loans.find(l => l.id === selectedLoanId);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <LayoutDashboard className="h-6 w-6 text-gray-900 mr-2" />
              <span className="text-xl font-semibold text-gray-900 tracking-tight">Vitto</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-500">{user.email}</span>
              <button 
                onClick={handleLogout}
                className="flex items-center text-sm text-gray-500 hover:text-gray-900 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Loan Selection & Payment */}
          <div className="lg:col-span-1 space-y-6">
            
            {/* Loan Selector */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Your Loans</h2>
              <div className="space-y-3">
                {loans.map(loan => (
                  <div 
                    key={loan.id}
                    onClick={() => setSelectedLoanId(loan.id)}
                    className={`cursor-pointer rounded-lg border p-4 transition-all ${
                      selectedLoanId === loan.id 
                        ? 'border-gray-900 bg-gray-50 ring-1 ring-gray-900' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-gray-900">{loan.id}</span>
                      <span className="text-sm text-gray-500">{loan.interestRate}% APR</span>
                    </div>
                    <div className="text-sm text-gray-500">
                      Balance: ${loan.outstanding.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment Form */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-gray-500" />
                Make a Payment
              </h2>
              
              <form onSubmit={handlePayment}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Amount to pay
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <span className="text-gray-500 sm:text-sm">$</span>
                    </div>
                    <input
                      type="number"
                      min="1"
                      step="0.01"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="pl-7 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent text-sm"
                      placeholder="0.00"
                    />
                  </div>
                </div>
                
                <button
                  type="submit"
                  disabled={paymentStatus === 'loading' || !paymentAmount}
                  className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-900 hover:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {paymentStatus === 'loading' ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    'Submit Payment'
                  )}
                </button>
                
                {paymentStatus === 'success' && (
                  <div className="mt-4 flex items-center text-sm text-emerald-600 bg-emerald-50 p-3 rounded-md">
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Payment processed successfully
                  </div>
                )}
                {paymentStatus === 'error' && (
                  <div className="mt-4 flex items-center text-sm text-red-600 bg-red-50 p-3 rounded-md">
                    <AlertCircle className="w-4 h-4 mr-2" />
                    Payment failed. Try again.
                  </div>
                )}
              </form>
            </div>
          </div>

          {/* Right Column: KPIs & Schedule */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center text-sm font-medium text-gray-500 mb-2">
                  <DollarSign className="w-4 h-4 mr-1" />
                  Total Amount
                </div>
                <div className="text-2xl font-semibold text-gray-900">
                  ${selectedLoan?.totalAmount.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center text-sm font-medium text-gray-500 mb-2">
                  Outstanding Balance
                </div>
                <div className="text-2xl font-semibold text-gray-900">
                  ${selectedLoan?.outstanding.toLocaleString()}
                </div>
              </div>
              
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
                <div className="flex items-center text-sm font-medium text-red-600 mb-2">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  Overdue Amount
                </div>
                <div className="text-2xl font-semibold text-red-600">
                  ${selectedLoan?.overdue.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Repayment Schedule Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-gray-500" />
                  Repayment Schedule
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Due Date
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Amount
                      </th>
                      <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {selectedLoan?.schedule.map((payment) => (
                      <tr key={payment.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {new Date(payment.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          ${payment.amount.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                            ${payment.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 
                              payment.status === 'Overdue' ? 'bg-red-100 text-red-800' : 
                              'bg-gray-100 text-gray-800'}`}
                          >
                            {payment.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
}
