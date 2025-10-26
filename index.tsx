import React, { useState, useEffect, useMemo, FormEvent, ChangeEvent } from 'react';
import { createRoot } from 'react-dom/client';

// --- 데이터 구조 정의 ---
interface Member {
  id: number;
  name: string;
  position: string;
}

interface Transaction {
  id: number;
  type: 'income' | 'expense';
  date: string;
  category: string;
  amount: number;
  memberId?: number;
  memo?: string;
}

interface DataSnapshot {
  timestamp: string;
  data: {
    members: Member[];
    transactions: Transaction[];
    expenseCategories: string[];
  };
}

// --- 상수 정의 ---
const POSITIONS = ["목사", "사모", "부목사", "전도사", "장로", "권사", "집사", "성도", "청년", "중고등부", "주일학교", "무명", "기타"];
const INCOME_CATEGORIES = ["십일조", "감사헌금", "건축헌금", "선교헌금", "주정헌금", "절기헌금", "생일감사", "심방감사", "일천번제", "기타"];
const todayString = () => new Date().toISOString().slice(0, 10);

const getDayOfWeek = (dateString: string): string => {
    if (!dateString) return '';
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    // Appending T00:00:00 ensures the date is parsed in the local timezone,
    // preventing shifts due to UTC interpretation of 'YYYY-MM-DD'.
    const date = new Date(`${dateString}T00:00:00`);
    if (isNaN(date.getTime())) return ''; // Invalid date
    return `(${days[date.getDay()]})`;
};


// --- LocalStorage를 위한 커스텀 Hook ---
function usePersistentState<T>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      const storedValue = localStorage.getItem(key);
      return storedValue ? JSON.parse(storedValue) : defaultValue;
    } catch (error) {
      console.error(`localStorage 읽기 오류 “${key}”:`, error);
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`localStorage 쓰기 오류 “${key}”:`, error);
    }
  }, [key, state]);

  return [state, setState];
}

const PasswordModal: React.FC<{
  mode: 'create' | 'enter';
  onClose: () => void;
  onConfirm: (password: string) => void;
}> = ({ mode, onClose, onConfirm }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!/^\d{4}$/.test(password)) {
      setError('비밀번호는 4자리 숫자여야 합니다.');
      return;
    }

    if (mode === 'create' && password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    
    onConfirm(password);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>{mode === 'create' ? '비밀번호 설정' : '비밀번호 입력'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="password-input">{mode === 'create' ? '새 비밀번호 (4자리 숫자)' : '비밀번호'}</label>
            <input
              id="password-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              maxLength={4}
              inputMode="numeric"
              autoComplete="new-password"
              required
              autoFocus
            />
          </div>
          {mode === 'create' && (
            <div className="form-group">
              <label htmlFor="confirm-password-input">비밀번호 확인</label>
              <input
                id="confirm-password-input"
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                maxLength={4}
                inputMode="numeric"
                autoComplete="new-password"
                required
              />
            </div>
          )}
          {error && <p className="error-message">{error}</p>}
          <button type="submit" className="submit-btn full-width">확인</button>
        </form>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [view, setView] = useState<'main' | 'addMember' | 'search' | 'editMembers' | 'snapshots'>('main');
  const [activeTab, setActiveTab] = useState<'income' | 'expense'>('income');
  
  const [members, setMembers] = usePersistentState<Member[]>('church_members_v2', []);
  const [transactions, setTransactions] = usePersistentState<Transaction[]>('church_transactions_v2', []);
  const [expenseCategories, setExpenseCategories] = usePersistentState<string[]>('church_expense_categories_v2', ['운영비', '선교비', '구제비']);
  const [password, setPassword] = usePersistentState<string | null>('church_app_password_v2', null);
  const [snapshots, setSnapshots] = usePersistentState<DataSnapshot[]>('church_data_snapshots_v1', []);

  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordModalProps, setPasswordModalProps] = useState({
      mode: 'enter' as 'create' | 'enter',
      onConfirm: (pw: string) => {},
      onClose: () => setShowPasswordModal(false)
  });

  // --- 새 성도 추가 핸들러 ---
  const handleAddMember = (name: string, position: string) => {
    if (!name.trim()) {
        alert("성도 이름을 입력해주세요.");
        return;
    }
    const newMember: Member = { id: Date.now(), name, position };
    setMembers(prev => [...prev, newMember].sort((a, b) => a.name.localeCompare(b.name, 'ko')));
    setView('main');
  };

  // --- 성도 수정/삭제 핸들러 ---
  const handleUpdateMember = (id: number, name: string, position: string) => {
    setMembers(prev => prev.map(m => m.id === id ? { ...m, name, position } : m)
                           .sort((a, b) => a.name.localeCompare(b.name, 'ko')));
  };
  
  const handleDeleteMember = (id: number) => {
    setMembers(prev => prev.filter(m => m.id !== id));
  };

  // --- 거래 관리 핸들러 ---
  const handleAddTransaction = (tx: Omit<Transaction, 'id'>) => {
    setTransactions(prev => [...prev, { ...tx, id: Date.now() }]);
  };

  const handleUpdateTransaction = (updatedTx: Transaction) => {
    setTransactions(prev => prev.map(tx => tx.id === updatedTx.id ? updatedTx : tx));
    setEditingTransaction(null);
  };

  const handleDeleteTransaction = (id: number) => {
      setTransactions(prev => prev.filter(tx => tx.id !== id));
  };
  
  // --- 새 지출 항목 추가 핸들러 ---
  const handleAddExpenseCategory = (category: string) => {
    if (category && !expenseCategories.includes(category)) {
      setExpenseCategories(prev => [...prev, category]);
    }
  };
  
  // --- 비밀번호 보호 작업 실행기 ---
  const runProtectedAction = (action: () => void) => {
    if (password) {
      setPasswordModalProps({
        mode: 'enter',
        onConfirm: (enteredPassword) => {
          if (enteredPassword === password) {
            setShowPasswordModal(false);
            action();
          } else {
            alert('비밀번호가 올바르지 않습니다.');
          }
        },
        onClose: () => setShowPasswordModal(false)
      });
    } else {
      setPasswordModalProps({
        mode: 'create',
        onConfirm: (newPassword) => {
          setPassword(newPassword);
          setShowPasswordModal(false);
          action();
        },
        onClose: () => setShowPasswordModal(false)
      });
    }
    setShowPasswordModal(true);
  };

  // --- 데이터 저장/불러오기 핸들러 ---
  const handleSaveData = () => {
    const performSave = () => {
      try {
        const dataToSave = { members, transactions, expenseCategories };
  
        // 1. 앱 내 목록에 자동으로 저장
        const newSnapshot: DataSnapshot = {
          timestamp: new Date().toISOString(),
          data: dataToSave,
        };
        setSnapshots(prev => [newSnapshot, ...prev].slice(0, 50));
  
        // 2. 컴퓨터에 데이터 저장 (파일 다운로드)
        const prettyJsonString = JSON.stringify(dataToSave, null, 2);
        const blob = new Blob([prettyJsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const fileName = `헌금_${todayString()}.json`;
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
  
        // 3. 저장 완료 알림 후 네이버 밴드 열기 확인
        if (window.confirm(`데이터가 앱 내 목록과 컴퓨터에 백업되었습니다.\n'${fileName}' 파일이 다운로드 폴더에 저장되었습니다.\n\n확인을 누르면 네이버 밴드로 이동하여 파일을 공유할 수 있습니다.`)) {
            window.open('https://band.us', '_blank');
        }
      } catch (error) {
        console.error('데이터 저장 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다.');
      }
    };
    runProtectedAction(performSave);
  };
  

  const handleLoadData = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const inputElement = event.target;

    const performLoad = () => {
        if (!window.confirm('데이터를 불러오면 현재 데이터가 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
            inputElement.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result;
                if (typeof text !== 'string') throw new Error("파일을 읽을 수 없습니다.");
                const parsedData = JSON.parse(text);

                // 데이터 구조 유효성 검사 강화
                if (typeof parsedData !== 'object' || parsedData === null || !Array.isArray(parsedData.members) || !Array.isArray(parsedData.transactions)) {
                    alert('파일의 데이터 구조가 올바르지 않아 불러올 수 없습니다.');
                    return;
                }

                // 핵심 데이터 불러오기
                setMembers(parsedData.members);
                setTransactions(parsedData.transactions);

                // 하위 호환성을 위해 지출 항목 데이터 처리
                if (Array.isArray(parsedData.expenseCategories)) {
                    setExpenseCategories(parsedData.expenseCategories);
                    alert('데이터를 성공적으로 불러왔습니다.');
                } else {
                    // 지출 항목이 없는 구버전 파일일 경우, 기본값으로 설정
                    const defaultExpenseCategories = ['운영비', '선교비', '구제비'];
                    setExpenseCategories(defaultExpenseCategories);
                    alert('이전 버전의 데이터를 불러왔습니다. 지출 항목은 기본값으로 설정됩니다.');
                }
            } catch (error) {
                console.error("데이터 불러오기 오류:", error);
                alert('데이터를 불러오는 중 오류가 발생했습니다. 파일이 손상되었거나 형식이 다를 수 있습니다.');
            } finally {
                inputElement.value = '';
            }
        };
        reader.readAsText(file);
    };
    runProtectedAction(performLoad);
  };
  
    const handleLoadSnapshot = (snapshotData: DataSnapshot['data']) => {
      if (window.confirm('저장된 데이터를 불러오면 현재 작업 내용이 모두 덮어쓰여집니다. 계속하시겠습니까?')) {
          setMembers(snapshotData.members);
          setTransactions(snapshotData.transactions);
          setExpenseCategories(snapshotData.expenseCategories);
          setView('main');
          alert('데이터를 성공적으로 불러왔습니다.');
      }
    };

    const handleDeleteSnapshot = (timestamp: string) => {
        const performDelete = () => {
            if (window.confirm(`${new Date(timestamp).toLocaleString('ko-KR')}에 저장된 데이터를 삭제하시겠습니까?`)) {
                setSnapshots(prev => prev.filter(s => s.timestamp !== timestamp));
            }
        }
        runProtectedAction(performDelete);
    };

  // --- 계산 로직 (useMemo로 최적화) ---
  const { sortedTransactions, balanceData, periodicalSummary, weeklyCategoryTotals, transactionsWithBalance } = useMemo(() => {
    const sorted = [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() || b.id - a.id);
    
    const todayStr = todayString();
    let previousBalance = 0;
    let todaysChange = 0;

    transactions.forEach(tx => {
        const amount = tx.type === 'income' ? tx.amount : -tx.amount;
        if (tx.date < todayStr) {
            previousBalance += amount;
        } else if (tx.date === todayStr) {
            todaysChange += amount;
        }
    });

    const todaysBalance = previousBalance + todaysChange;
    
    // 표시 순서: 십일조 -> 선교헌금 -> ... -> 기타
    // 코드 내 정렬을 위해 표시 순서의 역순으로 배열 정의
    const categoryOrder = ["기타", "일천번제", "심방감사", "생일감사", "절기헌금", "주정헌금", "감사헌금", "건축헌금", "선교헌금", "십일조"];
    
    const getMemberNameForSort = (memberId?: number): string => {
        if (memberId === undefined) return '무명';
        return members.find(m => m.id === memberId)?.name || '미지정';
    };

    let runningBalance = 0;
    const withBalance = [...transactions]
        .sort((a, b) => {
            // 1. Primary sort: date, ascending (for correct running balance calc)
            const dateCompare = new Date(a.date).getTime() - new Date(b.date).getTime();
            if (dateCompare !== 0) return dateCompare;

            // 2. Secondary sort for same-day transactions:
            // Income transactions should come before expense transactions.
            if (a.type !== b.type) {
                return a.type === 'income' ? -1 : 1;
            }

            // If both are income transactions, apply custom sorting logic.
            if (a.type === 'income') {
                const indexA = categoryOrder.indexOf(a.category);
                const indexB = categoryOrder.indexOf(b.category);
                // 배열에 없는 항목은 맨 뒤로
                const effectiveIndexA = indexA === -1 ? categoryOrder.length : indexA;
                const effectiveIndexB = indexB === -1 ? categoryOrder.length : indexB;

                // a) Sort by custom category order
                if (effectiveIndexA !== effectiveIndexB) {
                    // 최종 표시는 reverse되므로, 표시 순서의 역순인 categoryOrder 배열의 index 순으로 정렬
                    return effectiveIndexA - effectiveIndexB;
                }
                
                // b) Within the same category, sort by member name (alphabetical)
                const nameA = getMemberNameForSort(a.memberId);
                const nameB = getMemberNameForSort(b.memberId);
                // 최종 표시는 reverse되므로, 가나다순으로 표시하려면 여기서는 가나다 역순으로 정렬
                const nameCompare = nameB.localeCompare(nameA, 'ko');
                if (nameCompare !== 0) {
                    return nameCompare;
                }
            }
            
            // For expenses, or as a final fallback for incomes, sort by creation order (ID).
            return a.id - b.id;
        })
        .map(tx => {
            runningBalance += (tx.type === 'income' ? tx.amount : -tx.amount);
            return { ...tx, balance: runningBalance };
        })
        .reverse(); // Reverse the whole array to show most recent transactions first.
        
    const today = new Date(todayStr);
    const yearStartStr = today.getFullYear() + '-01-01';
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 0: Sunday
    const weekStartStr = weekStart.toISOString().slice(0, 10);

    let weeklyIncome = 0;
    let weeklyExpense = 0;
    let yearlyIncome = 0;
    let yearlyExpense = 0;
    
    const gyeongsangbiCategories = ["주정헌금", "십일조", "감사헌금", "생일감사", "심방감사", "일천번제"];
    const weeklyGyeongsangbiBreakdown: { [key: string]: number } = Object.fromEntries(
        gyeongsangbiCategories.map(cat => [cat, 0])
    );
    let weeklySeongyo = 0;
    let weeklyGeonchuk = 0;
    
    transactions.forEach(tx => {
        const amount = tx.amount;
        if (tx.date >= yearStartStr) {
            if (tx.type === 'income') yearlyIncome += amount;
            else yearlyExpense += amount;
        }
        if (tx.date >= weekStartStr) {
            if (tx.type === 'income') {
                weeklyIncome += amount;
                if (gyeongsangbiCategories.includes(tx.category)) {
                    weeklyGyeongsangbiBreakdown[tx.category] += amount;
                } else if (tx.category === '선교헌금') {
                    weeklySeongyo += amount;
                } else if (tx.category === '건축헌금') {
                    weeklyGeonchuk += amount;
                }
            } else {
                weeklyExpense += amount;
            }
        }
    });

    return {
      sortedTransactions: sorted,
      balanceData: { previousBalance, todaysChange, todaysBalance },
      periodicalSummary: {
          weeklyIncome,
          weeklyExpense,
          yearlyIncome,
          yearlyExpense,
          weeklyBalance: weeklyIncome - weeklyExpense,
          yearlyBalance: yearlyIncome - yearlyExpense,
      },
      weeklyCategoryTotals: {
          weeklyGyeongsangbiBreakdown,
          weeklySeongyo,
          weeklyGeonchuk
      },
      transactionsWithBalance: withBalance,
    };
  }, [transactions, members]);
  
  const getMemberName = (id?: number) => members.find(m => m.id === id)?.name || '미지정';

  return (
    <>
      <header>
        <h1>구미은혜로교회 헌금관리</h1>
        <div className="header-actions">
            <button onClick={() => setView('addMember')}>새 성도 추가</button>
            <button onClick={() => setView('search')}>조회</button>
            <button onClick={() => runProtectedAction(() => setView('editMembers'))}>회원수정</button>
            <button onClick={() => setView('snapshots')}>저장 목록</button>
        </div>
      </header>
      <div className="data-management top-data-management">
          <button onClick={handleSaveData} className="data-btn">데이터 저장</button>
          <label htmlFor="load-data-input-header" className="data-btn">
              데이터 불러오기
          </label>
          <input 
              id="load-data-input-header"
              type="file"
              accept=".json"
              onChange={handleLoadData}
              style={{ display: 'none' }}
          />
      </div>
      <main>
        {view === 'main' && (
          <>
            <div className="card">
              <div className="tabs">
                <button className={`tab-button ${activeTab === 'income' ? 'active' : ''}`} onClick={() => setActiveTab('income')}>입금</button>
                <button className={`tab-button ${activeTab === 'expense' ? 'active' : ''}`} onClick={() => setActiveTab('expense')}>출금</button>
              </div>
              {activeTab === 'income' ? (
                <IncomeForm members={members} onAddTransaction={handleAddTransaction} />
              ) : (
                <ExpenseForm members={members} categories={expenseCategories} onAddCategory={handleAddExpenseCategory} onAddTransaction={handleAddTransaction} />
              )}
            </div>
            <PeriodicalSummary {...periodicalSummary} />
            <WeeklyCategorySummary {...weeklyCategoryTotals} />
            <BalanceSummary {...balanceData} />
            <TransactionList 
              transactions={transactionsWithBalance} 
              getMemberName={getMemberName}
              onSaveData={handleSaveData}
              onLoadData={handleLoadData}
              onEdit={tx => runProtectedAction(() => setEditingTransaction(tx))}
              onDelete={id => runProtectedAction(() => {
                  if (window.confirm('이 거래 내역을 정말로 삭제하시겠습니까?')) {
                      handleDeleteTransaction(id);
                  }
              })}
            />
          </>
        )}
        {view === 'addMember' && <AddMemberModal onAddMember={handleAddMember} onClose={() => setView('main')} />}
        {view === 'editMembers' && <EditMembersModal members={members} onClose={() => setView('main')} onUpdateMember={handleUpdateMember} onDeleteMember={handleDeleteMember} />}
        {view === 'search' && <SearchModal transactions={transactions} members={members} getMemberName={getMemberName} incomeCategories={INCOME_CATEGORIES} expenseCategories={expenseCategories} onClose={() => setView('main')} />}
        {view === 'snapshots' && <SnapshotsModal snapshots={snapshots} onClose={() => setView('main')} onLoad={handleLoadSnapshot} onDelete={handleDeleteSnapshot} />}
        
        {editingTransaction && (
            <EditTransactionModal
                transaction={editingTransaction}
                onClose={() => setEditingTransaction(null)}
                onSave={handleUpdateTransaction}
                members={members}
                incomeCategories={INCOME_CATEGORIES}
                expenseCategories={expenseCategories}
                onAddCategory={handleAddExpenseCategory}
            />
        )}
        {showPasswordModal && <PasswordModal {...passwordModalProps} />}
      </main>
    </>
  );
};

// --- 컴포넌트들 ---

const WeeklyCategorySummary: React.FC<{
  weeklyGyeongsangbiBreakdown: { [key: string]: number };
  weeklySeongyo: number;
  weeklyGeonchuk: number;
}> = ({ weeklyGyeongsangbiBreakdown, weeklySeongyo, weeklyGeonchuk }) => (
  <section className="card periodical-summary category-breakdown-summary">
    <div className="summary-row">
      <span className="row-label">경상비</span>
      <div className="row-values gyeongsangbi">
        {Object.entries(weeklyGyeongsangbiBreakdown).map(([category, amount]) => (
            <div className="value-item" key={category}>
              <span className="value-label">{category}</span>
              <span className="value-amount">{amount.toLocaleString()}원</span>
            </div>
        ))}
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label">특별헌금</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">선교헌금</span>
          <span className="value-amount">{weeklySeongyo.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">건축헌금</span>
          <span className="value-amount">{weeklyGeonchuk.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </section>
);

const PeriodicalSummary: React.FC<{
  weeklyIncome: number;
  weeklyExpense: number;
  yearlyIncome: number;
  yearlyExpense: number;
  weeklyBalance: number;
  yearlyBalance: number;
}> = ({ weeklyIncome, weeklyExpense, yearlyIncome, yearlyExpense, weeklyBalance, yearlyBalance }) => (
  <section className="card periodical-summary">
    <div className="summary-row">
      <span className="row-label income-color">수입</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyIncome.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyIncome.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label expense-color">지출</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 총액</span>
          <span className="value-amount">{weeklyExpense.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 총액</span>
          <span className="value-amount">{yearlyExpense.toLocaleString()}원</span>
        </div>
      </div>
    </div>
    <div className="summary-row">
      <span className="row-label">잔액</span>
      <div className="row-values">
        <div className="value-item">
          <span className="value-label">금주 잔액</span>
          <span className="value-amount">{weeklyBalance.toLocaleString()}원</span>
        </div>
        <div className="value-item">
          <span className="value-label">금년 잔액</span>
          <span className="value-amount">{yearlyBalance.toLocaleString()}원</span>
        </div>
      </div>
    </div>
  </section>
);

const BalanceSummary: React.FC<{previousBalance: number, todaysChange: number, todaysBalance: number}> = ({ previousBalance, todaysChange, todaysBalance }) => (
  <section className="balance-summary">
    <div className="summary-item">
      <span className="summary-label">이전 잔액</span>
      <span className="summary-value">{previousBalance.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">오늘 변동금액</span>
      <span className={`summary-value ${todaysChange >= 0 ? 'income-color' : 'expense-color'}`}>{todaysChange.toLocaleString()}원</span>
    </div>
    <div className="summary-item">
      <span className="summary-label">금일 잔액</span>
      <span className="summary-value bold">{todaysBalance.toLocaleString()}원</span>
    </div>
  </section>
);

const IncomeForm: React.FC<{members: Member[], onAddTransaction: (tx: Omit<Transaction, 'id'>) => void}> = ({ members, onAddTransaction }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(INCOME_CATEGORIES[0]);
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [showAmountHelper, setShowAmountHelper] = useState(false);
  const presets = [1000, 5000, 10000, 50000, 100000];

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || Number(amount) <= 0 || memberId === '') {
      alert('모든 필수 항목을 입력해주세요.');
      return;
    }
    onAddTransaction({ type: 'income', date, category, amount: Number(amount), memberId: Number(memberId) });
    setMemberId('');
    setAmount('');
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="income-date" className="label-with-day">
          <span>입금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="income-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="income-category">입금 내역</label>
        <select id="income-category" value={category} onChange={e => setCategory(e.target.value)}>
          {INCOME_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="income-member">헌금자</label>
        <select id="income-member" value={memberId} onChange={e => setMemberId(Number(e.target.value))} required>
          <option value="" disabled>-- 성도 선택 --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="income-amount">금액 (원)</label>
        <div className="amount-input-container">
            <input 
                id="income-amount" 
                type="number" 
                placeholder="숫자만 입력" 
                value={amount} 
                onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} 
                required 
                min="1" 
            />
            <button 
                type="button" 
                className="toggle-amount-helper-btn" 
                onClick={() => setShowAmountHelper(prev => !prev)}
                aria-label="금액 선택 도우미 열기/닫기"
                aria-expanded={showAmountHelper}
            >
                ₩
            </button>
        </div>
        {showAmountHelper && (
            <div className="amount-helper">
                {presets.map(preset => (
                    <div key={preset} className="amount-preset-row">
                        <button type="button" className="amount-preset-btn" onClick={() => setAmount(preset)}>
                            {preset.toLocaleString()}원
                        </button>
                        <div className="amount-adjust-btns">
                            <button type="button" onClick={() => setAmount(prev => (Number(prev) || 0) + preset)} aria-label={`${preset.toLocaleString()}원 더하기`}>+</button>
                            <button type="button" onClick={() => setAmount(prev => Math.max(0, (Number(prev) || 0) - preset))} aria-label={`${preset.toLocaleString()}원 빼기`}>-</button>
                        </div>
                    </div>
                ))}
            </div>
        )}
      </div>
      <button type="submit" className="submit-btn">등록 완료</button>
    </form>
  );
};

const ExpenseForm: React.FC<{members: Member[], categories: string[], onAddCategory: (cat: string) => void, onAddTransaction: (tx: Omit<Transaction, 'id'>) => void}> = ({ members, categories, onAddCategory, onAddTransaction }) => {
  const [date, setDate] = useState(todayString);
  const [category, setCategory] = useState(categories[0] || '');
  const [memberId, setMemberId] = useState<number | ''>('');
  const [amount, setAmount] = useState<number | ''>('');
  const [memo, setMemo] = useState('');
  
  const handleAddCategory = () => {
    const newCategory = prompt('추가할 출금 항목 이름을 입력하세요:');
    if (newCategory) onAddCategory(newCategory.trim());
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (amount === '' || amount <= 0 || !category) {
      alert('출금 내역과 금액을 정확히 입력해주세요.');
      return;
    }
    onAddTransaction({ type: 'expense', date, category, amount: Number(amount), memberId: memberId === '' ? undefined : Number(memberId), memo });
    setMemberId('');
    setAmount('');
    setMemo('');
  };

  return (
    <form onSubmit={handleSubmit} className="transaction-form">
      <div className="form-group">
        <label htmlFor="expense-date" className="label-with-day">
          <span>출금 날짜</span>
          <span>{getDayOfWeek(date)}</span>
        </label>
        <input id="expense-date" type="date" value={date} onChange={e => setDate(e.target.value)} required />
      </div>
      <div className="form-group">
        <label htmlFor="expense-category">출금 내역</label>
        <div className="category-input">
          <select id="expense-category" value={category} onChange={e => setCategory(e.target.value)} required>
            <option value="" disabled>-- 항목 선택 --</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button type="button" onClick={handleAddCategory} className="add-category-btn">+</button>
        </div>
      </div>
      <div className="form-group">
        <label htmlFor="expense-user">사용자</label>
        <select id="expense-user" value={memberId} onChange={e => setMemberId(Number(e.target.value))}>
          <option value="">-- 선택 사항 --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="expense-amount">금액 (원)</label>
        <input id="expense-amount" type="number" placeholder="숫자만 입력" value={amount} onChange={e => setAmount(Number(e.target.value))} required min="1" />
      </div>
      <div className="form-group">
        <label htmlFor="expense-memo">비고</label>
        <input id="expense-memo" type="text" value={memo} onChange={e => setMemo(e.target.value)} placeholder="메모 (선택사항)" />
      </div>
      <button type="submit" className="submit-btn">등록</button>
    </form>
  );
};

const TransactionList: React.FC<{
  transactions: (Transaction & {balance: number})[], 
  getMemberName: (id?: number) => string,
  onSaveData: () => void,
  onLoadData: (event: ChangeEvent<HTMLInputElement>) => void,
  onEdit: (tx: Transaction) => void,
  onDelete: (id: number) => void
}> = ({ transactions, getMemberName, onSaveData, onLoadData, onEdit, onDelete }) => {
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 20;

    useEffect(() => {
        setCurrentPage(1);
    }, [transactions]);

    const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
    const paginatedTransactions = transactions.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handlePageChange = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
        }
    };
    
    return (
        <section className="card">
            <h2>거래 내역</h2>
            <div className="transaction-list">
                <div className="transaction-header">
                    <span>날짜</span>
                    <span>입금</span>
                    <span>출금</span>
                    <span>금액</span>
                    <span>잔액</span>
                    <span>작업</span>
                </div>
                {transactions.length === 0 ? (
                    <p className="empty-list">거래 내역이 없습니다.</p>
                ) : (
                    paginatedTransactions.map(({ balance, ...tx }) => (
                        <div key={tx.id} className={`transaction-item ${tx.type}`}>
                            <span>{tx.date}</span>
                            <span>{tx.type === 'income' ? `${getMemberName(tx.memberId)} (${tx.category})` : '-'}</span>
                            <span>{tx.type === 'expense' ? tx.category : '-'}</span>
                            <span className={tx.type === 'income' ? 'income-color' : 'expense-color'}>{tx.amount.toLocaleString()}원</span>
                            <span>{balance.toLocaleString()}원</span>
                            <div className="transaction-actions">
                                <button onClick={() => onEdit(tx)} className="action-btn edit">수정</button>
                                <button onClick={() => onDelete(tx.id)} className="action-btn delete">삭제</button>
                            </div>
                        </div>
                    ))
                )}
            </div>
            
            {totalPages > 1 && (
                <div className="pagination-controls">
                    <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}>
                        &lt;
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <button 
                            key={page} 
                            onClick={() => handlePageChange(page)}
                            className={currentPage === page ? 'active' : ''}
                        >
                            {page}
                        </button>
                    ))}
                    <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}>
                        &gt;
                    </button>
                </div>
            )}

            <div className="data-management">
                <button onClick={onSaveData} className="data-btn">데이터 저장</button>
                <label htmlFor="load-data-input" className="data-btn">
                    데이터 불러오기
                </label>
                <input 
                    id="load-data-input"
                    type="file"
                    accept=".json"
                    onChange={onLoadData}
                    style={{ display: 'none' }}
                />
            </div>
        </section>
    );
};

const AddMemberModal: React.FC<{onAddMember: (name: string, position: string) => void, onClose: () => void}> = ({ onAddMember, onClose }) => {
  const [name, setName] = useState('');
  const [position, setPosition] = useState(POSITIONS[0]);
  
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onAddMember(name, position);
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <button onClick={onClose} className="close-btn">&times;</button>
        <h2>새 성도 추가</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="new-member-name">이름</label>
            <input id="new-member-name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div className="form-group">
            <label htmlFor="new-member-position">직분</label>
            <select id="new-member-position" value={position} onChange={e => setPosition(e.target.value)}>
              {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <button type="submit" className="submit-btn">추가</button>
        </form>
      </div>
    </div>
  );
};

const EditMembersModal: React.FC<{
    members: Member[];
    onClose: () => void;
    onUpdateMember: (id: number, newName: string, newPosition: string) => void;
    onDeleteMember: (id: number) => void;
}> = ({ members, onClose, onUpdateMember, onDeleteMember }) => {
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editPosition, setEditPosition] = useState('');

    const handleEditStart = (member: Member) => {
        setEditingId(member.id);
        setEditName(member.name);
        setEditPosition(member.position);
    };

    const handleEditCancel = () => {
        setEditingId(null);
    };

    const handleEditSave = () => {
        if (editingId && editName.trim()) {
            onUpdateMember(editingId, editName.trim(), editPosition);
            setEditingId(null);
        } else {
            alert('이름을 입력해주세요.');
        }
    };

    const handleDelete = (member: Member) => {
        if (window.confirm(`${member.name} (${member.position}) 님을 삭제하시겠습니까?\n관련된 모든 거래 내역은 유지되지만, 이름이 '미지정'으로 표시됩니다.`)) {
            onDeleteMember(member.id);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>회원 수정 및 삭제</h2>
                <ul className="member-list">
                    {members.map(member => (
                        <li key={member.id} className="member-item">
                            {editingId === member.id ? (
                                <>
                                    <div className="edit-form">
                                        <input 
                                            type="text" 
                                            value={editName} 
                                            onChange={(e) => setEditName(e.target.value)} 
                                            placeholder="이름"
                                        />
                                        <select value={editPosition} onChange={(e) => setEditPosition(e.target.value)}>
                                            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={handleEditSave} className="save-btn">저장</button>
                                        <button onClick={handleEditCancel} className="cancel-btn">취소</button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div className="member-info">
                                        <span>{member.name}</span>
                                        <small>{member.position}</small>
                                    </div>
                                    <div className="member-actions">
                                        <button onClick={() => handleEditStart(member)} className="edit-btn">수정</button>
                                        <button onClick={() => handleDelete(member)} className="delete-btn">삭제</button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

const EditTransactionModal: React.FC<{
    transaction: Transaction;
    onClose: () => void;
    onSave: (tx: Transaction) => void;
    members: Member[];
    incomeCategories: string[];
    expenseCategories: string[];
    onAddCategory: (cat: string) => void;
}> = ({ transaction, onClose, onSave, members, incomeCategories, expenseCategories, onAddCategory }) => {
    const [formData, setFormData] = useState<Transaction>(transaction);

    useEffect(() => {
        setFormData(transaction);
    }, [transaction]);

    const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        
        let processedValue: string | number | undefined = value;
        if (name === 'amount') {
            processedValue = value === '' ? 0 : Number(value);
        } else if (name === 'memberId') {
            processedValue = value === '' ? undefined : Number(value);
        }

        setFormData(prev => ({
            ...prev,
            [name]: processedValue,
        }));
    };
    
    const handleSubmit = (e: FormEvent) => {
        e.preventDefault();
        if (formData.amount <= 0) {
            alert('금액은 0보다 커야 합니다.');
            return;
        }
        if (formData.type === 'income' && !formData.memberId) {
            alert('헌금자를 선택해주세요.');
            return;
        }
        onSave(formData);
    };

    const handleAddCategory = () => {
        const newCategory = prompt('추가할 출금 항목 이름을 입력하세요:');
        if (newCategory) onAddCategory(newCategory.trim());
    };

    return (
        <div className="modal-backdrop">
            <div className="modal-content">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>거래 내역 수정</h2>
                <form onSubmit={handleSubmit} className="transaction-form">
                    {/* Common Fields */}
                    <div className="form-group">
                        <label htmlFor="edit-date" className="label-with-day">
                            <span>날짜</span>
                            <span>{getDayOfWeek(formData.date)}</span>
                        </label>
                        <input id="edit-date" name="date" type="date" value={formData.date} onChange={handleChange} required />
                    </div>
                    
                    <div className="form-group">
                        <label htmlFor="edit-amount">금액 (원)</label>
                        <input id="edit-amount" name="amount" type="number" value={formData.amount} onChange={handleChange} required min="1" />
                    </div>

                    {/* Type-specific Fields */}
                    {formData.type === 'income' ? (
                        <>
                            <div className="form-group">
                                <label htmlFor="edit-income-category">입금 내역</label>
                                <select id="edit-income-category" name="category" value={formData.category} onChange={handleChange}>
                                    {incomeCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-income-member">헌금자</label>
                                <select id="edit-income-member" name="memberId" value={formData.memberId || ''} onChange={handleChange} required>
                                    <option value="" disabled>-- 성도 선택 --</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
                                </select>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="form-group">
                                <label htmlFor="edit-expense-category">출금 내역</label>
                                <div className="category-input">
                                    <select id="edit-expense-category" name="category" value={formData.category} onChange={handleChange} required>
                                        <option value="" disabled>-- 항목 선택 --</option>
                                        {expenseCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                    </select>
                                    <button type="button" onClick={handleAddCategory} className="add-category-btn">+</button>
                                </div>
                            </div>
                            <div className="form-group">
                                <label htmlFor="edit-expense-user">사용자</label>
                                <select id="edit-expense-user" name="memberId" value={formData.memberId || ''} onChange={handleChange}>
                                    <option value="">-- 선택 사항 --</option>
                                    {members.map(m => <option key={m.id} value={m.id}>{m.name} ({m.position})</option>)}
                                </select>
                            </div>
                            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                                <label htmlFor="edit-expense-memo">비고</label>
                                <input id="edit-expense-memo" name="memo" type="text" value={formData.memo || ''} onChange={handleChange} placeholder="메모 (선택사항)" />
                            </div>
                        </>
                    )}
                    
                    <div className="form-actions">
                        <button type="button" onClick={onClose} className="cancel-btn form-btn">취소</button>
                        <button type="submit" className="submit-btn form-btn">저장</button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SnapshotsModal: React.FC<{
    snapshots: DataSnapshot[];
    onClose: () => void;
    onLoad: (snapshotData: DataSnapshot['data']) => void;
    onDelete: (timestamp: string) => void;
}> = ({ snapshots, onClose, onLoad, onDelete }) => {
    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>저장된 데이터 목록</h2>
                {snapshots.length === 0 ? (
                    <p className="empty-list">저장된 데이터가 없습니다.</p>
                ) : (
                    <ul className="snapshot-list">
                        {snapshots.map(snapshot => (
                            <li key={snapshot.timestamp} className="snapshot-item">
                                <div className="snapshot-info">
                                    <span>{new Date(snapshot.timestamp).toLocaleString('ko-KR')}</span>
                                    <small>
                                        성도: {snapshot.data.members.length}명, 거래: {snapshot.data.transactions.length}건
                                    </small>
                                </div>
                                <div className="snapshot-actions">
                                    <button onClick={() => onLoad(snapshot.data)} className="load-btn">불러오기</button>
                                    <button onClick={() => onDelete(snapshot.timestamp)} className="delete-btn">삭제</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

const SearchModal: React.FC<{
    transactions: Transaction[], 
    members: Member[], 
    getMemberName: (id?: number) => string,
    incomeCategories: string[],
    expenseCategories: string[],
    onClose: () => void
}> = ({ transactions, members, getMemberName, incomeCategories, expenseCategories, onClose }) => {
    const [searchType, setSearchType] = useState<'name' | 'category'>('name');
    const [nameQuery, setNameQuery] = useState<number | ''>('');
    
    const [categoryType, setCategoryType] = useState<'income' | 'expense'>('income');
    const [categoryQuery, setCategoryQuery] = useState('');

    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().slice(0, 10);
    });
    const [endDate, setEndDate] = useState(todayString);

    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => tx.date >= startDate && tx.date <= endDate);
    }, [transactions, startDate, endDate]);

    const todaysTotals = useMemo(() => {
        const today = todayString();
        const todaysTransactions = transactions.filter(tx => tx.date === today);
        
        const totalIncome = todaysTransactions
            .filter(tx => tx.type === 'income')
            .reduce((sum, tx) => sum + tx.amount, 0);

        const totalExpense = todaysTransactions
            .filter(tx => tx.type === 'expense')
            .reduce((sum, tx) => sum + tx.amount, 0);
            
        return { totalIncome, totalExpense };
    }, [transactions]);

    const nameSearchResult = useMemo(() => {
        if (searchType !== 'name' || nameQuery === '') return null;
        const result = filteredTransactions.filter(tx => tx.memberId === nameQuery && tx.type === 'income');
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, nameQuery]);

    const categorySearchResult = useMemo(() => {
        if (searchType !== 'category' || categoryQuery === '') return null;
        const result = filteredTransactions.filter(tx => tx.type === categoryType && tx.category === categoryQuery);
        const total = result.reduce((sum, tx) => sum + tx.amount, 0);
        return { transactions: result, total };
    }, [filteredTransactions, searchType, categoryType, categoryQuery]);

    return (
        <div className="modal-backdrop">
            <div className="modal-content large">
                <button onClick={onClose} className="close-btn">&times;</button>
                <h2>조회</h2>
                <div className="search-controls">
                    <div className="form-group date-range">
                        <label>기간 설정:</label>
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        <span>~</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                    </div>
                    <div className="tabs">
                        <button className={`tab-button ${searchType === 'name' ? 'active' : ''}`} onClick={() => setSearchType('name')}>이름 조회</button>
                        <button className={`tab-button ${searchType === 'category' ? 'active' : ''}`} onClick={() => setSearchType('category')}>항목별 조회</button>
                    </div>

                    {searchType === 'name' && (
                        <div className="form-group">
                            <label>이름:</label>
                            <select value={nameQuery} onChange={e => setNameQuery(Number(e.target.value))}>
                                <option value="" disabled>-- 성도 선택 --</option>
                                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                            </select>
                        </div>
                    )}
                    {searchType === 'category' && (
                        <div className="category-search-container">
                            <div className="category-search-group">
                                <select value={categoryType} onChange={e => { setCategoryType(e.target.value as 'income' | 'expense'); setCategoryQuery(''); }}>
                                    <option value="income">입금</option>
                                    <option value="expense">출금</option>
                                </select>
                                <select value={categoryQuery} onChange={e => setCategoryQuery(e.target.value)}>
                                    <option value="" disabled>-- 항목 선택 --</option>
                                    {(categoryType === 'income' ? incomeCategories : expenseCategories).map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div className="today-totals-summary">
                                <div>
                                    <span>오늘의 입금 총액</span>
                                    <span className="income-color">{todaysTotals.totalIncome.toLocaleString()}원</span>
                                </div>
                                <div>
                                    <span>오늘의 출금 총액</span>
                                    <span className="expense-color">{todaysTotals.totalExpense.toLocaleString()}원</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="search-results">
                    {nameSearchResult && (
                        <>
                            <h3>{getMemberName(nameQuery)}님 헌금 내역 (총: {nameSearchResult.total.toLocaleString()}원)</h3>
                            <ul>{nameSearchResult.transactions.map(tx => <li key={tx.id}>{tx.date} | {tx.category}: {tx.amount.toLocaleString()}원</li>)}</ul>
                        </>
                    )}
                    {categorySearchResult && (
                        <>
                           <h3>{categoryQuery} 내역 (총: {categorySearchResult.total.toLocaleString()}원)</h3>
                           <ul>{categorySearchResult.transactions.map(tx => <li key={tx.id}>{tx.date} | {tx.type === 'income' ? getMemberName(tx.memberId) : (tx.memo || '메모 없음')}: {tx.amount.toLocaleString()}원</li>)}</ul>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(<App />);