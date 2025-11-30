import React, { useState, useEffect } from 'react';
import { 
  Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowLeftRight, 
  History, Trash2, Landmark 
} from 'lucide-react';
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { 
  collection, addDoc, deleteDoc, doc, onSnapshot, serverTimestamp 
} from "firebase/firestore";

// Import initialized instances
import { auth, db, APP_ID } from './firebase';

const App = () => {
  // --- State ---
  const [user, setUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Input State
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [inputType, setInputType] = useState('expense'); 
  const [amount, setAmount] = useState('');
  const [label, setLabel] = useState('');

  // --- Auth & Data Fetching ---
  useEffect(() => {
    // Simple anonymous sign-in for personal use
    signInAnonymously(auth).catch((error) => {
        console.error("Auth failed", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Path: artifacts/{APP_ID}/users/{uid}/transactions
    const q = collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions');
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      // Sort by date desc in memory (Firestore index workaround)
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setTransactions(data);
      setLoading(false);
    }, (error) => {
      console.error("Data fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Logic ---
  const addTransaction = async (e) => {
    e.preventDefault();
    if (!amount || !label || !user) return;

    try {
      await addDoc(collection(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions'), {
        amount: parseFloat(amount),
        type: inputType,
        label: label,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
        timestamp: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
        createdAt: serverTimestamp()
      });
      setAmount('');
      setLabel('');
      setIsInputOpen(false);
    } catch (err) {
      console.error("Error adding doc:", err);
    }
  };

  const deleteTransaction = async (id) => {
    if (!user || !window.confirm("Delete this entry?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'users', user.uid, 'transactions', id));
    } catch (err) {
      console.error("Error deleting:", err);
    }
  };

  // --- Calculations ---
  const stats = transactions.reduce((acc, curr) => {
    const val = parseFloat(curr.amount);
    if (curr.type === 'income') acc.income += val;
    if (curr.type === 'expense') acc.expense += val;
    if (curr.type === 'savings') acc.savings += val;
    if (curr.type === 'lend') acc.owedToMe += val;
    if (curr.type === 'owe') acc.iOwe += val;
    return acc;
  }, { income: 0, expense: 0, savings: 0, owedToMe: 0, iOwe: 0 });

  const currentBalance = stats.income - stats.expense - stats.savings;

  // --- Components ---
  const QuickButton = ({ type, icon: Icon, colorClass, label }) => (
    <button 
      onClick={() => { setInputType(type); setIsInputOpen(true); }}
      className="flex flex-col items-center justify-center p-3 bg-slate-800 hover:bg-slate-700 active:bg-slate-600 border border-slate-700 rounded-xl transition-all group"
    >
      <div className={`${colorClass} p-2 rounded-full mb-2 group-hover:scale-110 transition-transform bg-opacity-20`}>
        <Icon className={`w-5 h-5 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white pb-24">
      
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 p-6 sticky top-0 z-10 shadow-lg">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-emerald-400 flex items-center gap-2">
              <Landmark className="w-5 h-5" /> Abbas's Ledger
            </h1>
            <p className="text-xs text-slate-400">Personal Finance Tracker</p>
          </div>
          <div className="bg-slate-700 px-3 py-1 rounded-full text-xs font-mono text-emerald-300 border border-slate-600">
            {loading ? "..." : "Online"}
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-6">

        {/* Hero Card */}
        <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 shadow-xl border border-slate-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl"></div>
          
          <div className="flex flex-col mb-4">
            <p className="text-slate-400 text-sm font-medium">Net Available Funds</p>
            <h2 className="text-4xl font-bold text-white tracking-tight">£{currentBalance.toFixed(2)}</h2>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-700/50">
             <div>
                <p className="text-xs text-slate-400 flex items-center gap-1"><PiggyBank size={12}/> Savings</p>
                <p className="text-emerald-400 font-bold">£{stats.savings.toFixed(2)}</p>
             </div>
             <div>
                <p className="text-xs text-slate-400 flex items-center gap-1"><ArrowLeftRight size={12}/> Net Debt</p>
                <p className={`${stats.owedToMe - stats.iOwe >= 0 ? 'text-blue-400' : 'text-red-400'} font-bold`}>
                    {stats.owedToMe - stats.iOwe >= 0 ? '+' : ''}£{(stats.owedToMe - stats.iOwe).toFixed(2)}
                </p>
             </div>
          </div>
        </div>

        {/* Input Form */}
        {isInputOpen && (
          <div className="bg-slate-800 p-4 rounded-xl border border-emerald-500/50 animate-in slide-in-from-top-2">
            <h3 className="text-sm font-semibold text-emerald-400 mb-3 uppercase tracking-wider">
              Add {inputType === 'lend' ? 'Loan (Lend)' : inputType === 'owe' ? 'Debt (Borrow)' : inputType}
            </h3>
            <form onSubmit={addTransaction} className="space-y-3">
              <div>
                <input 
                  type="number" 
                  step="0.01" 
                  placeholder="Amount (£)" 
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <input 
                  type="text" 
                  placeholder={inputType === 'lend' ? "Who did you lend to?" : inputType === 'owe' ? "Who did you borrow from?" : "Description"} 
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsInputOpen(false)} className="flex-1 py-2 text-slate-400 hover:text-white transition-colors">Cancel</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-medium transition-colors">Save</button>
              </div>
            </form>
          </div>
        )}

        {/* Quick Actions */}
        {!isInputOpen && (
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 ml-1">Log Transaction</h3>
          <div className="grid grid-cols-4 gap-2">
            <QuickButton type="income" icon={TrendingUp} colorClass="bg-emerald-500 text-emerald-400" label="Earn" />
            <QuickButton type="expense" icon={TrendingDown} colorClass="bg-red-500 text-red-400" label="Spend" />
            <QuickButton type="savings" icon={PiggyBank} colorClass="bg-purple-500 text-purple-400" label="Save" />
            <QuickButton type="lend" icon={ArrowLeftRight} colorClass="bg-blue-500 text-blue-400" label="Lend/Owe" />
          </div>
           <div className="grid grid-cols-2 gap-2 mt-2">
             <button 
               onClick={() => { setInputType('lend'); setIsInputOpen(true); }}
               className="flex items-center justify-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-blue-300 hover:bg-slate-700"
             >
                <ArrowLeftRight size={14} /> I Lent Money
             </button>
             <button 
               onClick={() => { setInputType('owe'); setIsInputOpen(true); }}
               className="flex items-center justify-center gap-2 p-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-orange-300 hover:bg-slate-700"
             >
                <History size={14} /> I Borrowed
             </button>
           </div>
        </div>
        )}

        {/* History List */}
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
          <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-400" /> Recent Activity
            </h3>
            {loading && <span className="text-xs animate-pulse text-emerald-400">Syncing...</span>}
          </div>
          
          <div className="max-h-64 overflow-y-auto custom-scrollbar">
            {transactions.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
                <Wallet className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p className="text-sm">No transactions yet.</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-700/50">
                {transactions.map((item) => (
                  <li key={item.id} className="p-4 flex justify-between items-center hover:bg-slate-700/30 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className={`
                        w-8 h-8 rounded-full flex items-center justify-center
                        ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-400' : 
                          item.type === 'expense' ? 'bg-red-500/10 text-red-400' : 
                          item.type === 'savings' ? 'bg-purple-500/10 text-purple-400' :
                          'bg-blue-500/10 text-blue-400'}
                      `}>
                        {item.type === 'income' && <TrendingUp size={14}/>}
                        {item.type === 'expense' && <TrendingDown size={14}/>}
                        {item.type === 'savings' && <PiggyBank size={14}/>}
                        {(item.type === 'lend' || item.type === 'owe') && <ArrowLeftRight size={14}/>}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-200">{item.label}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{item.type} • {item.date}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="text-right">
                            <span className={`font-mono font-medium block
                                ${item.type === 'income' ? 'text-emerald-400' : 
                                item.type === 'expense' ? 'text-red-400' : 
                                item.type === 'savings' ? 'text-purple-400' :
                                'text-blue-400'}
                            `}>
                                {item.type === 'income' ? '+' : item.type === 'expense' || item.type === 'savings' ? '-' : ''}
                                £{parseFloat(item.amount).toFixed(2)}
                            </span>
                            {(item.type === 'lend') && <span className="text-[10px] text-slate-500">Asset</span>}
                            {(item.type === 'owe') && <span className="text-[10px] text-slate-500">Liability</span>}
                        </div>
                      <button 
                        onClick={() => deleteTransaction(item.id)}
                        className="text-slate-600 hover:text-red-400 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

      </main>

      {/* Stats Footer */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 p-4 pb-6 grid grid-cols-3 text-center text-[10px] text-slate-500">
        <div className="border-r border-slate-700">
            <p className="text-emerald-400 font-bold text-sm">£{stats.income.toFixed(0)}</p>
            <span>In</span>
        </div>
        <div className="border-r border-slate-700">
            <p className="text-red-400 font-bold text-sm">£{stats.expense.toFixed(0)}</p>
            <span>Out</span>
        </div>
        <div>
            <p className="text-blue-400 font-bold text-sm">£{(stats.owedToMe - stats.iOwe).toFixed(0)}</p>
            <span>Debt Net</span>
        </div>
      </nav>
    </div>
  );
};

export default App;
