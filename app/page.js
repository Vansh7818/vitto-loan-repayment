"use client";

import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  signInWithRedirect, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  getRedirectResult
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { v4 as uuidv4 } from 'uuid';
import { 
  LayoutDashboard, LogOut, CreditCard, AlertCircle, CheckCircle2,
  Calendar, DollarSign, TrendingUp, Clock, History, PlusCircle, X,
  Smartphone, Building, CreditCard as CardIcon
} from 'lucide-react';

export default function Home() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  
  const [loans, setLoans] = useState([]);
  const [selectedLoanId, setSelectedLoanId] = useState(null);
  const [loanDetails, setLoanDetails] = useState(null);
  const [fetchingLoans, setFetchingLoans] = useState(false);
  const [fetchingDetails, setFetchingDetails] = useState(false);
  
  // Payment State
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [paymentStatus, setPaymentStatus] = useState(null);
  const [paymentError, setPaymentError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [receipt, setReceipt] = useState(null);

  // Create Loan State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLoanPrincipal, setNewLoanPrincipal] = useState('');
  const [newLoanRate, setNewLoanRate] = useState('');
  const [newLoanTenure, setNewLoanTenure] = useState('');
  const [newLoanDate, setNewLoanDate] = useState('');
  const [createStatus, setCreateStatus] = useState(null);
  const [createError, setCreateError] = useState('');

  useEffect(() => {
    // Check for redirect result first
    getRedirectResult(auth).then((result) => {
      if (result?.user) {
        setUser(result.user);
      }
    }).catch((error) => {
      setAuthError('Google sign-in failed: ' + error.message);
    });

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (user) {
      fetchLoans();
    }
  }, [user]);

  useEffect(() => {
    if (selectedLoanId) {
      fetchLoanDetails(selectedLoanId);
      // Reset payment states when loan changes
      setPaymentAmount('');
      setPaymentError('');
      setReceipt(null);
    }
  }, [selectedLoanId]);

  const fetchLoans = async () => {
    setFetchingLoans(true);
    try {
      const res = await fetch('/api/loans');
      const data = await res.json();
      if (data.success) {
        setLoans(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingLoans(false);
    }
  };

  const fetchLoanDetails = async (id) => {
    setFetchingDetails(true);
    try {
      const res = await fetch(`/api/loans/${id}`);
      const data = await res.json();
      if (data.success) {
        setLoanDetails(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingDetails(false);
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      if (error.code === 'auth/user-not-found' || error.code === 'auth/invalid-credential') {
        try {
          await createUserWithEmailAndPassword(auth, email, password);
        } catch (signupError) {
          setAuthError('Sign-in failed. Could not auto-create account: ' + signupError.message);
        }
      } else {
        setAuthError('Authentication failed: ' + error.message);
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithRedirect(auth, provider);
    } catch (error) {
      setAuthError('Google sign-in failed: ' + error.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  const initiatePayment = (e) => {
    e.preventDefault();
    setPaymentError('');
    if (!paymentAmount || isNaN(paymentAmount) || Number(paymentAmount) <= 0) {
      setPaymentError('Please enter a valid amount.');
      return;
    }
    // Check if amount exceeds total outstanding mathematically before API call for better UX
    const maxPossible = loanDetails?.currentPosition?.outstandingPrincipal + (loanDetails?.schedule?.reduce((acc, inst) => acc + inst.interestComponent, 0) || 0); // rough estimate
    if (Number(paymentAmount) > loanDetails?.currentPosition?.outstandingPrincipal * 1.5) {
      // Just a rough client side check, real check is server side
    }
    setShowConfirmModal(true);
  };

  const executePayment = async () => {
    setPaymentStatus('loading');
    setPaymentError('');
    
    try {
      const idempotencyKey = uuidv4();
      const res = await fetch(`/api/loans/${selectedLoanId}/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({ amount: Number(paymentAmount) }),
      });
      
      const data = await res.json();
      if (data.success) {
        setPaymentStatus('success');
        setReceipt({
          id: data.data.payment.id,
          amount: data.data.payment.amount,
          date: data.data.payment.paymentDate,
          method: paymentMethod.toUpperCase()
        });
        setPaymentAmount('');
        await fetchLoanDetails(selectedLoanId);
        // We keep the confirm modal open to show the receipt
      } else {
        setPaymentStatus('error');
        setPaymentError(data.error?.message || 'Payment failed');
        setShowConfirmModal(false);
      }
    } catch (err) {
      setPaymentStatus('error');
      setPaymentError('Network error. Please try again.');
      setShowConfirmModal(false);
    }
  };

  const handleCreateLoan = async (e) => {
    e.preventDefault();
    setCreateError('');
    setCreateStatus('loading');
    
    try {
      const res = await fetch('/api/loans', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          principal: Number(newLoanPrincipal),
          annualInterestRate: Number(newLoanRate),
          tenureMonths: Number(newLoanTenure),
          disbursementDate: newLoanDate
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setCreateStatus('success');
        await fetchLoans();
        setTimeout(() => {
          setShowCreateModal(false);
          setCreateStatus(null);
          setNewLoanPrincipal('');
          setNewLoanRate('');
          setNewLoanTenure('');
          setNewLoanDate('');
          setSelectedLoanId(data.data.id);
        }, 1500);
      } else {
        setCreateStatus('error');
        setCreateError(data.error?.message || 'Failed to create loan');
      }
    } catch (err) {
      setCreateStatus('error');
      setCreateError('Network error');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    // ... Login Screen ... (Kept exactly same)
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
          <div className="px-8 pt-10 pb-8 text-center bg-slate-900 text-white">
            <h1 className="text-3xl font-bold mb-2">Vitto</h1>
            <p className="text-slate-300 text-sm">Fintech Operations Dashboard</p>
          </div>
          <div className="p-8">
            {authError && (
              <div className="mb-6 flex items-start text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                <span className="break-words">{authError}</span>
              </div>
            )}
            
            <form onSubmit={handleEmailLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900" placeholder="admin@vitto.money" required />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-shadow text-slate-900" placeholder="••••••••" required />
              </div>
              <button type="submit" className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-lg shadow-sm transition-colors focus:ring-2 focus:ring-offset-2 focus:ring-slate-900">
                Sign In securely
              </button>
            </form>
            
            <div className="mt-8">
              <div className="relative">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-200"></div></div>
                <div className="relative flex justify-center text-sm"><span className="px-4 bg-white text-slate-500">Or continue with</span></div>
              </div>
              <button onClick={handleGoogleLogin} className="mt-6 w-full flex justify-center items-center py-2.5 px-4 border border-slate-300 rounded-lg shadow-sm bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
                Google
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const formatMoney = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative pb-12">
      
      {/* Payment Confirmation & Receipt Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
            {receipt ? (
              <div className="p-8 text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 mb-4">
                  <CheckCircle2 className="h-10 w-10 text-emerald-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-1">Payment Successful!</h3>
                <p className="text-slate-500 text-sm mb-6">Your transaction has been securely processed.</p>
                
                <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-100 mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className="font-bold text-slate-900">{formatMoney(receipt.amount)}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Method</span>
                    <span className="font-medium text-slate-700">{receipt.method}</span>
                  </div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-slate-500">Txn ID</span>
                    <span className="font-mono text-xs text-slate-500 mt-0.5">{receipt.id.split('-')[0]}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Date</span>
                    <span className="text-slate-700">{new Date(receipt.date).toLocaleDateString()}</span>
                  </div>
                </div>
                
                <button 
                  onClick={() => { setShowConfirmModal(false); setReceipt(null); setPaymentStatus(null); }}
                  className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-xl shadow-sm transition-colors"
                >
                  Done
                </button>
              </div>
            ) : (
              <div className="p-6">
                <div className="flex justify-between items-center mb-5">
                  <h3 className="text-lg font-bold text-slate-900">Confirm Payment</h3>
                  <button onClick={() => setShowConfirmModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-4 mb-6">
                  <div className="flex items-center justify-between p-4 border border-indigo-100 bg-indigo-50/50 rounded-xl">
                    <span className="text-sm font-medium text-indigo-900">Amount to Pay</span>
                    <span className="text-xl font-bold text-indigo-700">{formatMoney(paymentAmount)}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-600">
                    <span className="w-8 flex justify-center mr-2 text-slate-400">
                      {paymentMethod === 'upi' ? <Smartphone className="w-4 h-4" /> : paymentMethod === 'bank' ? <Building className="w-4 h-4" /> : <CardIcon className="w-4 h-4" />}
                    </span>
                    Paying via {paymentMethod === 'upi' ? 'UPI' : paymentMethod === 'bank' ? 'Bank Transfer' : 'Debit Card'}
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed pt-2 border-t border-slate-100">
                    By confirming, this amount will be immediately allocated against your outstanding installments according to standard Vitto policy (interest first, then principal).
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button onClick={() => setShowConfirmModal(false)} className="flex-1 py-2.5 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-xl hover:bg-slate-50">Cancel</button>
                  <button onClick={executePayment} disabled={paymentStatus === 'loading'} className="flex-1 py-2.5 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-xl hover:bg-indigo-700 flex justify-center items-center">
                    {paymentStatus === 'loading' ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> : 'Confirm & Pay'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Loan Modal (Kept same) */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-semibold text-slate-900 flex items-center"><PlusCircle className="w-5 h-5 mr-2 text-indigo-600" /> Originate New Loan</h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6">
              <form onSubmit={handleCreateLoan} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Principal Amount (₹)</label>
                  <input type="number" min="1" value={newLoanPrincipal} onChange={(e) => setNewLoanPrincipal(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm" required placeholder="200000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Annual Interest Rate (%)</label>
                  <input type="number" step="0.1" min="0.1" value={newLoanRate} onChange={(e) => setNewLoanRate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm" required placeholder="18" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Tenure (Months)</label>
                  <input type="number" min="1" value={newLoanTenure} onChange={(e) => setNewLoanTenure(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm" required placeholder="24" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Disbursement Date</label>
                  <input type="date" value={newLoanDate} onChange={(e) => setNewLoanDate(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm" required />
                </div>
                {createError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{createError}</div>}
                {createStatus === 'success' && <div className="text-sm text-emerald-700 bg-emerald-50 p-3 rounded-lg border border-emerald-100 flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" /> Loan created successfully!</div>}
                <div className="pt-4 flex justify-end space-x-3">
                  <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={createStatus === 'loading'} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center">
                    {createStatus === 'loading' && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>}
                    Create Loan
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <LayoutDashboard className="w-6 h-6 text-indigo-600 mr-2" />
              <span className="font-bold text-xl tracking-tight text-slate-900">Vitto Ops</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-500 hidden sm:block bg-slate-100 px-3 py-1 rounded-full font-medium">{user.email || 'Admin'}</span>
              <button onClick={handleLogout} className="inline-flex items-center px-3 py-1.5 border border-slate-200 rounded-md text-sm font-medium text-slate-600 bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-200 transition-colors">
                <LogOut className="w-4 h-4 mr-1.5" /> Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Loan Selector & Payment */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80 flex justify-between items-center">
                <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Active Portfolios</h2>
                <button onClick={() => setShowCreateModal(true)} className="text-indigo-600 hover:text-indigo-800 transition-colors flex items-center text-xs font-semibold bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                  <PlusCircle className="w-3.5 h-3.5 mr-1" /> New
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                {fetchingLoans ? (
                  <div className="text-center py-8 text-slate-400 text-sm">Loading loans...</div>
                ) : loans.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 bg-slate-50 rounded-lg border border-dashed border-slate-200 text-sm">No loans found. Create one.</div>
                ) : (
                  loans.map((loan) => (
                    <div
                      key={loan.id}
                      onClick={() => setSelectedLoanId(loan.id)}
                      className={`cursor-pointer rounded-xl border p-4 transition-all ${selectedLoanId === loan.id ? 'border-indigo-500 bg-indigo-50/40 ring-1 ring-indigo-500 shadow-sm' : 'border-slate-200 hover:border-slate-300 hover:shadow-sm bg-white'}`}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{loan.id.split('-')[1] || loan.id.substring(0,6)}</span>
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${selectedLoanId === loan.id ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {Number(loan.annualInterestRate)}% APR
                        </span>
                      </div>
                      <div className="flex justify-between text-sm items-end mt-3">
                        <span className="text-slate-500 text-xs font-medium uppercase tracking-wide">Principal</span>
                        <span className="font-bold text-slate-900 text-base">{formatMoney(loan.principal)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {selectedLoanId && loanDetails && (
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/80">
                  <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                    <CreditCard className="w-4 h-4 mr-2 text-indigo-600" /> Record Repayment
                  </h2>
                </div>
                
                <div className="p-6">
                  {paymentError && (
                    <div className="mb-4 flex items-start text-sm text-red-700 bg-red-50 p-3 rounded-lg border border-red-100">
                      <AlertCircle className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  <form onSubmit={initiatePayment}>
                    <div className="mb-5">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Amount to Collect</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <span className="text-slate-500 font-medium">₹</span>
                        </div>
                        <input
                          type="number" min="1" step="0.01" value={paymentAmount} onChange={(e) => setPaymentAmount(e.target.value)}
                          className="pl-9 w-full px-4 py-3 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-lg font-medium shadow-sm transition-shadow"
                          placeholder="0.00"
                        />
                      </div>
                      <div className="flex justify-between mt-2 px-1">
                        <span className="text-xs text-slate-500">Next due: <span className="font-semibold text-slate-700">{formatMoney(loanDetails.currentPosition.nextDueAmount)}</span></span>
                        {loanDetails.currentPosition.overdueAmount > 0 && (
                          <span className="text-xs text-red-600 font-medium cursor-pointer hover:underline" onClick={() => setPaymentAmount(loanDetails.currentPosition.overdueAmount.toString())}>
                            Pay Overdue ({formatMoney(loanDetails.currentPosition.overdueAmount)})
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button type="button" onClick={() => setPaymentMethod('upi')} className={`py-2 px-3 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'upi' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          <Smartphone className="w-5 h-5 mb-1" />
                          <span className="text-xs font-semibold">UPI</span>
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('bank')} className={`py-2 px-3 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'bank' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          <Building className="w-5 h-5 mb-1" />
                          <span className="text-xs font-semibold">Bank</span>
                        </button>
                        <button type="button" onClick={() => setPaymentMethod('card')} className={`py-2 px-3 border rounded-xl flex flex-col items-center justify-center transition-all ${paymentMethod === 'card' ? 'border-indigo-600 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}>
                          <CardIcon className="w-5 h-5 mb-1" />
                          <span className="text-xs font-semibold">Card</span>
                        </button>
                      </div>
                    </div>
                    
                    <button
                      type="submit" disabled={!paymentAmount}
                      className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:shadow-lg active:transform active:scale-[0.98]"
                    >
                      Proceed to Review
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: KPIs & Schedule & History */}
          <div className="lg:col-span-8 space-y-6">
            {!selectedLoanId ? (
              <div className="h-full min-h-[500px] flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center bg-gradient-to-br from-white to-slate-50">
                <div>
                  <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <TrendingUp className="w-10 h-10 text-indigo-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Portfolio Overview</h3>
                  <p className="text-slate-500 max-w-sm mx-auto leading-relaxed">
                    Select a loan portfolio from the left menu to view detailed analytics, schedule, and record transactions.
                  </p>
                </div>
              </div>
            ) : fetchingDetails || !loanDetails ? (
              <div className="h-64 flex items-center justify-center bg-white rounded-xl shadow-sm border border-slate-200">
                <div className="animate-pulse flex flex-col items-center">
                  <div className="h-8 w-8 bg-indigo-200 rounded-full mb-4"></div>
                  <div className="h-4 w-32 bg-slate-200 rounded"></div>
                </div>
              </div>
            ) : (
              <>
                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      <div className="p-1.5 bg-indigo-50 rounded-lg mr-2"><DollarSign className="w-4 h-4 text-indigo-600" /></div>
                      Outstanding
                    </div>
                    <div className="text-2xl font-black text-slate-900 tracking-tight">
                      {formatMoney(loanDetails.currentPosition.outstandingPrincipal)}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <div className="p-1.5 bg-emerald-50 rounded-lg mr-2"><TrendingUp className="w-4 h-4 text-emerald-600" /></div>
                        Progress
                      </div>
                      <span className="text-sm font-bold text-emerald-600">{loanDetails.currentPosition.repaymentProgress.toFixed(1)}%</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2.5 mt-2 overflow-hidden shadow-inner">
                      <div className="bg-gradient-to-r from-emerald-400 to-emerald-600 h-2.5 rounded-full" style={{ width: `${Math.min(100, loanDetails.currentPosition.repaymentProgress)}%` }}></div>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                      <div className="p-1.5 bg-blue-50 rounded-lg mr-2"><Clock className="w-4 h-4 text-blue-600" /></div>
                      Next Due
                    </div>
                    <div className="text-xl font-black text-slate-900 tracking-tight">
                      {formatMoney(loanDetails.currentPosition.nextDueAmount)}
                    </div>
                    <div className="text-xs font-medium text-slate-500 mt-1.5 flex items-center">
                      <Calendar className="w-3 h-3 mr-1" />
                      {loanDetails.currentPosition.nextDueDate ? new Date(loanDetails.currentPosition.nextDueDate).toLocaleDateString(undefined, {month:'short', day:'numeric', year:'numeric'}) : 'Fully Paid'}
                    </div>
                  </div>
                  
                  <div className={`rounded-xl shadow-sm border p-5 transition-shadow hover:shadow-md ${loanDetails.currentPosition.overdueAmount > 0 ? 'bg-red-50/50 border-red-200' : 'bg-white border-slate-200'}`}>
                    <div className={`flex items-center text-xs font-bold uppercase tracking-wider mb-3 ${loanDetails.currentPosition.overdueAmount > 0 ? 'text-red-700' : 'text-slate-500'}`}>
                      <div className={`p-1.5 rounded-lg mr-2 ${loanDetails.currentPosition.overdueAmount > 0 ? 'bg-red-100' : 'bg-slate-50'}`}>
                        <AlertCircle className={`w-4 h-4 ${loanDetails.currentPosition.overdueAmount > 0 ? 'text-red-600' : 'text-slate-400'}`} />
                      </div>
                      Overdue
                    </div>
                    <div className={`text-2xl font-black tracking-tight ${loanDetails.currentPosition.overdueAmount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                      {formatMoney(loanDetails.currentPosition.overdueAmount)}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* Schedule Table (takes up 2 columns on wide screens) */}
                  <div className="xl:col-span-2 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                        <Calendar className="w-4 h-4 mr-2 text-indigo-600" /> Repayment Schedule
                      </h3>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-100">
                        {loanDetails.schedule.length} Installments
                      </span>
                    </div>
                    <div className="overflow-x-auto flex-1 max-h-[500px] overflow-y-auto">
                      <table className="min-w-full divide-y divide-slate-200">
                        <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-200">
                          <tr>
                            <th scope="col" className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">#</th>
                            <th scope="col" className="px-5 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">Due Date</th>
                            <th scope="col" className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Principal</th>
                            <th scope="col" className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Interest</th>
                            <th scope="col" className="px-5 py-3 text-right text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                            <th scope="col" className="px-5 py-3 text-center text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-slate-100">
                          {loanDetails.schedule.map((inst) => {
                            const isOverdue = inst.status === 'Overdue';
                            const isPaid = inst.status === 'Paid';
                            const isPartial = !isPaid && inst.amountPaid > 0;
                            
                            return (
                              <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                                <td className="px-5 py-3 whitespace-nowrap text-xs font-medium text-slate-500">{inst.installmentNumber}</td>
                                <td className="px-5 py-3 whitespace-nowrap text-sm font-semibold text-slate-900">
                                  {new Date(inst.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                </td>
                                <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600 text-right font-medium">{formatMoney(inst.principalComponent)}</td>
                                <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600 text-right font-medium">{formatMoney(inst.interestComponent)}</td>
                                <td className="px-5 py-3 whitespace-nowrap text-sm font-bold text-slate-900 text-right">{formatMoney(inst.totalDue)}</td>
                                <td className="px-5 py-3 whitespace-nowrap text-center">
                                  <div className="flex flex-col items-center">
                                    <span className={`px-2.5 py-1 inline-flex text-[11px] leading-4 font-bold rounded-md border uppercase tracking-wide
                                      ${isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
                                        isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 
                                        isPartial ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                        'bg-slate-50 text-slate-600 border-slate-200'}`}
                                    >
                                      {isPartial ? 'Partial' : inst.status}
                                    </span>
                                    {inst.amountPaid > 0 && !isPaid && (
                                      <span className="text-[10px] text-slate-500 font-medium mt-1">
                                        Paid {formatMoney(inst.amountPaid)}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Payments History Ledger */}
                  <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-[500px]">
                    <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/80">
                      <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center">
                        <History className="w-4 h-4 mr-2 text-indigo-600" /> Ledger
                      </h3>
                    </div>
                    <div className="p-0 overflow-y-auto flex-1">
                      {(!loanDetails.payments || loanDetails.payments.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center p-6">
                          <History className="w-8 h-8 text-slate-200 mb-3" />
                          <p className="text-center text-slate-500 text-sm font-medium">No payments recorded yet.</p>
                        </div>
                      ) : (
                        <ul className="divide-y divide-slate-100">
                          {loanDetails.payments.map((payment) => (
                            <li key={payment.id} className="p-4 hover:bg-slate-50/50 transition-colors">
                              <div className="flex justify-between items-start mb-1">
                                <span className="text-sm font-bold text-slate-900">Payment</span>
                                <span className="text-sm font-black text-emerald-600">
                                  +{formatMoney(payment.amount)}
                                </span>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-xs font-medium text-slate-500">
                                  {new Date(payment.paymentDate).toLocaleString('en-US', { 
                                    month: 'short', day: 'numeric', year: 'numeric' 
                                  })}
                                </span>
                                <span className="text-[10px] font-mono text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                  #{payment.id.substring(0,8)}
                                </span>
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
        </div>
      </main>
    </div>
  );
}
