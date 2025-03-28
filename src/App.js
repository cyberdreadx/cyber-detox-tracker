import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, Timestamp, where } from "firebase/firestore";
import { db } from "./firebase";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './App.css';

// Constants
const COMMON_SYMPTOMS = ["Irritability", "Anxiety", "Insomnia", "Loss of appetite", "Strange dreams", "Headache", "Sweating", "Craving", "Depression", "Restlessness", "Nausea", "Brain fog"];
const DETOX_TIPS = ["Stay hydrated", "Exercise regularly", "Get adequate sleep", "Eat fiber-rich foods", "Reduce stress", "Avoid alcohol", "Try sauna sessions"];
const NAVY_RESOURCES = [
  { title: "Navy Drug and Alcohol Prevention", url: "https://www.mynavyhr.navy.mil/Support-Services/21st-Century-Sailor/Drug-Alcohol/" },
  { title: "Navy Recruiting Command", url: "https://www.cnrc.navy.mil/" }
];

// Helper functions
const calculateTimeRemaining = () => {
  const targetDate = new Date('April 23, 2025');
  const now = new Date();
  const difference = targetDate - now;
  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  return { days, hours, minutes };
};

const estimateTHCLevels = (usageFrequency, daysClean) => {
  const baselineDays = usageFrequency === "light" ? 7 : usageFrequency === "moderate" ? 15 : 30;
  return Math.round(Math.max(0, 100 - (daysClean / baselineDays * 100)));
};

function App() {
  // State
  const [logs, setLogs] = useState([]);
  const [testResults, setTestResults] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedSymptoms, setSelectedSymptoms] = useState([]);
  const [customSymptom, setCustomSymptom] = useState('');
  const [notes, setNotes] = useState('');
  const [intensity, setIntensity] = useState(5);
  const [usageFrequency, setUsageFrequency] = useState('heavy');
  const [timeRemaining, setTimeRemaining] = useState(calculateTimeRemaining());
  const [daysClean, setDaysClean] = useState(0);
  const [waterIntake, setWaterIntake] = useState(0);
  const [exercise, setExercise] = useState(0);
  const [thcLevel, setThcLevel] = useState(100);
  const [passProbability, setPassProbability] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chartData, setChartData] = useState([]);
  const [randomTip, setRandomTip] = useState('');

  // Set up a random tip and change it daily
  useEffect(() => {
    setRandomTip(DETOX_TIPS[Math.floor(Math.random() * DETOX_TIPS.length)]);

    const tipInterval = setInterval(() => {
      setRandomTip(DETOX_TIPS[Math.floor(Math.random() * DETOX_TIPS.length)]);
    }, 86400000); // 24 hours

    return () => clearInterval(tipInterval);
  }, []);

  // Fetch data from Firebase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);

        // Get logs from Firestore
        const logsCollection = collection(db, "logs");
        const q = query(logsCollection, orderBy("createdAt", "desc"));
        const querySnapshot = await getDocs(q);
        const logsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Get test results from Firestore
        const testCollection = collection(db, "testResults");
        const testQuery = query(testCollection, orderBy("date", "desc"));
        const testSnapshot = await getDocs(testQuery);
        const resultsList = testSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Get settings
        const settingsDoc = doc(db, "settings", "user");
        const settingsSnapshot = await getDoc(settingsDoc);
        if (settingsSnapshot.exists()) {
          const data = settingsSnapshot.data();
          if (data.usageFrequency) setUsageFrequency(data.usageFrequency);
          if (data.darkMode !== undefined) setDarkMode(data.darkMode);
        }

        // Get health data for today
        const today = new Date().toISOString().split('T')[0];
        const healthCollection = collection(db, "healthTracking");
        const todayQuery = query(healthCollection, where("date", "==", today));
        const healthSnapshot = await getDocs(todayQuery);
        if (!healthSnapshot.empty) {
          const healthData = healthSnapshot.docs[0].data();
          setWaterIntake(healthData.waterIntake || 0);
          setExercise(healthData.exercise || 0);
        }

        setLogs(logsList);
        setTestResults(resultsList);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load data. Using localStorage as fallback.");
        const savedLogs = localStorage.getItem('detoxLogs');
        if (savedLogs) setLogs(JSON.parse(savedLogs));
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  // Apply dark mode
  useEffect(() => {
    document.body.classList.toggle('dark-mode', darkMode);
  }, [darkMode]);

  // Update time remaining every minute
  useEffect(() => {
    const timer = setInterval(() => setTimeRemaining(calculateTimeRemaining()), 60000);
    return () => clearInterval(timer);
  }, []);

  // Process logs for chart and calculations
  useEffect(() => {
    if (logs.length > 0) {
      // Calculate days clean
      const sortedLogs = [...logs].sort((a, b) => new Date(a.date) - new Date(b.date));
      const firstLogDate = new Date(sortedLogs[0].date);
      const now = new Date();
      const diffDays = Math.ceil(Math.abs(now - firstLogDate) / (1000 * 60 * 60 * 24));
      setDaysClean(diffDays);

      // Create chart data
      const uniqueDates = [...new Set(logs.map(log => log.date))].sort();
      const chartDataArray = uniqueDates.map(date => {
        const logsForDate = logs.filter(log => log.date === date);
        const avgIntensity = logsForDate.reduce((sum, log) => sum + log.intensity, 0) / logsForDate.length;
        const daysSinceStart = Math.ceil(Math.abs(new Date(date) - firstLogDate) / (1000 * 60 * 60 * 24));

        return {
          date,
          intensity: Math.round(avgIntensity * 10) / 10,
          thcLevel: estimateTHCLevels(usageFrequency, daysSinceStart)
        };
      });

      setChartData(chartDataArray);

      // Calculate current THC level and pass probability
      const currentTHC = estimateTHCLevels(usageFrequency, diffDays);
      setThcLevel(currentTHC);
      setPassProbability(Math.max(0, Math.min(100, 100 - currentTHC)));
    }
  }, [logs, usageFrequency]);

  // Helper methods
  const handleUsageFrequencyChange = async (e) => {
    const newFrequency = e.target.value;
    setUsageFrequency(newFrequency);
    try {
      await setDoc(doc(db, "settings", "user"), {
        usageFrequency: newFrequency,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error updating usage frequency:", err);
    }
  };

  const toggleDarkMode = async () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    try {
      await setDoc(doc(db, "settings", "user"), {
        darkMode: newMode,
        updatedAt: Timestamp.now()
      }, { merge: true });
    } catch (err) {
      console.error("Error updating dark mode:", err);
    }
  };

  const updateHealthMetric = async (metric, change) => {
    const stateUpdater = metric === 'water' ? setWaterIntake : setExercise;
    const currentValue = metric === 'water' ? waterIntake : exercise;
    const newValue = Math.max(0, currentValue + change);

    stateUpdater(newValue);

    try {
      const today = new Date().toISOString().split('T')[0];
      const healthQuery = query(collection(db, "healthTracking"), where("date", "==", today));
      const snapshot = await getDocs(healthQuery);
      const updateData = {
        [metric === 'water' ? 'waterIntake' : 'exercise']: newValue,
        updatedAt: Timestamp.now()
      };

      if (snapshot.empty) {
        const newDoc = {
          date: today,
          waterIntake: metric === 'water' ? newValue : 0,
          exercise: metric === 'exercise' ? newValue : 0,
          createdAt: Timestamp.now()
        };
        await setDoc(doc(collection(db, "healthTracking")), newDoc);
      } else {
        await setDoc(doc(db, "healthTracking", snapshot.docs[0].id), updateData, { merge: true });
      }
    } catch (err) {
      console.error(`Error updating ${metric}:`, err);
    }
  };

  const toggleSymptom = (symptom) => {
    setSelectedSymptoms(prev =>
      prev.includes(symptom)
        ? prev.filter(s => s !== symptom)
        : [...prev, symptom]
    );
  };

  const addCustomSymptom = () => {
    if (customSymptom && !selectedSymptoms.includes(customSymptom)) {
      setSelectedSymptoms(prev => [...prev, customSymptom]);
      setCustomSymptom('');
    }
  };

  const saveLog = async () => {
    try {
      const newLog = {
        date: currentDate,
        time: new Date().toLocaleTimeString(),
        symptoms: [...selectedSymptoms],
        intensity,
        notes,
        createdAt: Timestamp.now()
      };

      const docRef = doc(collection(db, "logs"));
      await setDoc(docRef, newLog);

      setLogs([{ id: docRef.id, ...newLog }, ...logs]);
      setSelectedSymptoms([]);
      setNotes('');
      setIntensity(5);

      localStorage.setItem('detoxLogs', JSON.stringify([{ id: docRef.id, ...newLog }, ...logs]));
    } catch (err) {
      console.error("Error adding log:", err);
      alert("Failed to save entry. Please try again.");
    }
  };

  const saveTestResult = async (result) => {
    try {
      const newResult = {
        date: currentDate,
        result: result, // 'positive' or 'negative'
        notes: notes,
        createdAt: Timestamp.now()
      };

      const testCollection = collection(db, "testResults");
      const docRef = doc(testCollection);
      await setDoc(docRef, newResult);

      setTestResults([{ id: docRef.id, ...newResult }, ...testResults]);
      setNotes('');

      return true;
    } catch (err) {
      console.error("Error saving test result:", err);
      return false;
    }
  };

  const deleteLog = async (id) => {
    try {
      await deleteDoc(doc(db, "logs", id));
      const updatedLogs = logs.filter(log => log.id !== id);
      setLogs(updatedLogs);
      localStorage.setItem('detoxLogs', JSON.stringify(updatedLogs));
    } catch (err) {
      console.error("Error deleting log:", err);
      alert("Failed to delete entry. Please try again.");
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify({
      logs, testResults, usageFrequency, daysClean, exportDate: new Date().toISOString()
    }, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileName = `cyberdetox-data-${new Date().toISOString().split('T')[0]}.json`;

    const link = document.createElement('a');
    link.setAttribute('href', dataUri);
    link.setAttribute('download', exportFileName);
    link.click();
  };

  const simulateTest = () => {
    const passes = Math.random() * 100 <= passProbability;
    alert(`Test Simulation: ${passes ? "PASS" : "FAIL"}\n\nPass Probability: ${passProbability}%\nTHC Level: ${thcLevel}%`);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
        <div className="content-wrapper loading">Loading your data...</div>
      </div>
    );
  }

  return (
    <div className={`app-container ${darkMode ? 'dark-mode' : ''}`}>
      <div className="content-wrapper">
        {/* Header */}
        <header className="app-header">
          <h1 className="title">CyberDetox Tracker</h1>
          <div className="stats-container">
            <div className="stat">Days Clean: {daysClean}</div>
            <div className="stat">T-minus: {timeRemaining.days}d {timeRemaining.hours}h {timeRemaining.minutes}m</div>
            <button onClick={toggleDarkMode} className="mode-toggle">{darkMode ? "☀️" : "🌙"}</button>
          </div>
        </header>

        {error && <div className="error-message">{error} <button onClick={() => setError(null)}>Dismiss</button></div>}

        {/* Tip of the day */}
        <div className="tip-card"><strong>Tip:</strong> {randomTip}</div>

        {/* Navigation */}
        <div className="nav-tabs">
          <button
            className={activeTab === 'dashboard' ? 'active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={activeTab === 'log' ? 'active' : ''}
            onClick={() => setActiveTab('log')}
          >
            Log Symptoms
          </button>
          <button
            className={activeTab === 'tests' ? 'active' : ''}
            onClick={() => setActiveTab('tests')}
          >
            Test Results
          </button>
          <button
            className={activeTab === 'health' ? 'active' : ''}
            onClick={() => setActiveTab('health')}
          >
            Health
          </button>
          <button
            className={activeTab === 'resources' ? 'active' : ''}
            onClick={() => setActiveTab('resources')}
          >
            Resources
          </button>
        </div>

        {/* Content based on active tab */}
        {activeTab === 'dashboard' && (
          <>
            <div className="card">
              <h2>Progress Dashboard</h2>
              <div className="dashboard-stats">
                <div className="stat-box">
                  <h3>THC Remaining</h3>
                  <div className="circle-progress">
                    <svg viewBox="0 0 36 36">
                      <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="circle-progress-path" strokeDasharray={`${thcLevel}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <text x="18" y="20.35" className="circle-text">{thcLevel}%</text>
                    </svg>
                  </div>
                </div>
                <div className="stat-box">
                  <h3>Pass Probability</h3>
                  <div className="circle-progress">
                    <svg viewBox="0 0 36 36">
                      <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <path className="circle-progress-path success" strokeDasharray={`${passProbability}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                      <text x="18" y="20.35" className="circle-text">{passProbability}%</text>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            <div className="usage-selector">
              <label>Update Usage Pattern:</label>
              <select
                value={usageFrequency}
                onChange={handleUsageFrequencyChange}
                className="select-input"
              >
                <option value="heavy">Heavy (daily use)</option>
                <option value="moderate">Moderate (several times/week)</option>
                <option value="light">Light (occasional use)</option>
              </select>
            </div>

            <div className="card">
              <h2>Progress Chart</h2>
              <div className="chart-container">
                {chartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis yAxisId="left" orientation="left" />
                      <YAxis yAxisId="right" orientation="right" />
                      <Tooltip />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="intensity" stroke="#8884d8" name="Symptom Intensity" />
                      <Line yAxisId="right" type="monotone" dataKey="thcLevel" stroke="#82ca9d" name="THC Level %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="empty-chart">No data yet. Start logging symptoms to see your progress.</p>
                )}
              </div>
              <button onClick={exportData} className="export-btn">Export Your Data</button>
            </div>
          </>
        )}

        {activeTab === 'log' && (
          <div className="card">
            <h2>Log New Entry</h2>
            <div className="input-group">
              <label>Date:</label>
              <input type="date" value={currentDate} onChange={(e) => setCurrentDate(e.target.value)} className="text-input" />
            </div>

            <div className="input-group">
              <label>Symptoms:</label>
              <div className="symptoms-grid">
                {COMMON_SYMPTOMS.map(symptom => (
                  <button
                    key={symptom}
                    onClick={() => toggleSymptom(symptom)}
                    className={`symptom-btn ${selectedSymptoms.includes(symptom) ? 'active' : ''}`}
                  >
                    {symptom}
                  </button>
                ))}
              </div>

              <div className="custom-symptom">
                <input
                  type="text"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  placeholder="Custom symptom..."
                  className="text-input"
                />
                <button onClick={addCustomSymptom} className="action-btn">Add</button>
              </div>
            </div>

            <div className="input-group">
              <label>Intensity (1-10):</label>
              <input
                type="range"
                min="1"
                max="10"
                value={intensity}
                onChange={(e) => setIntensity(parseInt(e.target.value))}
                className="range-input"
              />
              <div className="range-labels">
                <span>1</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>

            <div className="input-group">
              <label>Notes:</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="textarea-input"
                placeholder="How are you feeling? Any coping strategies that helped today?"
              ></textarea>
            </div>

            <button onClick={saveLog} className="save-btn">SAVE ENTRY</button>
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="card">
            <h2>THC Test Results</h2>

            <div className="test-input-section">
              <div className="input-group">
                <label>Date:</label>
                <input
                  type="date"
                  value={currentDate}
                  onChange={(e) => setCurrentDate(e.target.value)}
                  className="text-input"
                />
              </div>

              <div className="input-group">
                <label>Test Result:</label>
                <div className="test-buttons">
                  <button
                    onClick={() => saveTestResult('positive')}
                    className="test-btn positive"
                  >
                    Positive (Failed)
                  </button>
                  <button
                    onClick={() => saveTestResult('negative')}
                    className="test-btn negative"
                  >
                    Negative (Passed)
                  </button>
                </div>
              </div>

              <div className="input-group">
                <label>Notes:</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="textarea-input"
                  placeholder="Any observations about the test (e.g., faint line, test conditions)..."
                ></textarea>
              </div>
            </div>

            <div className="test-results-list">
              <h3>Previous Test Results</h3>

              {testResults.length === 0 ? (
                <p className="empty-results">No test results recorded yet.</p>
              ) : (
                <div className="results-list">
                  {testResults.map(test => (
                    <div key={test.id} className={`test-result ${test.result}`}>
                      <div className="result-header">
                        <span className="result-date">{test.date}</span>
                        <span className={`result-badge ${test.result}`}>
                          {test.result === 'positive' ? 'Failed' : 'Passed'}
                        </span>
                      </div>

                      {test.notes && (
                        <div className="result-notes">
                          <strong>Notes:</strong> {test.notes}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'health' && (
          <div className="card">
            <h2>Health Tracking</h2>

            <div className="health-section">
              <h3>Water Intake</h3>
              <div className="progress-container">
                <div style={{ width: `${Math.min(100, (waterIntake / 8) * 100)}%` }} className="progress-bar water-progress"></div>
              </div>
              <div className="health-text">{waterIntake} of 8 glasses</div>
              <div className="health-buttons">
                <button onClick={() => updateHealthMetric('water', -1)} className="health-btn">-</button>
                <button onClick={() => updateHealthMetric('water', 1)} className="health-btn">+</button>
              </div>
            </div>

            <div className="health-section">
              <h3>Exercise (Minutes)</h3>
              <div className="progress-container">
                <div style={{ width: `${Math.min(100, (exercise / 30) * 100)}%` }} className="progress-bar exercise-progress"></div>
              </div>
              <div className="health-text">{exercise} of 30 minutes</div>
              <div className="health-buttons">
                <button onClick={() => updateHealthMetric('exercise', -5)} className="health-btn">-5</button>
                <button onClick={() => updateHealthMetric('exercise', 5)} className="health-btn">+5</button>
                <button onClick={() => updateHealthMetric('exercise', 15)} className="health-btn">+15</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'resources' && (
          <div className="card">
            <h2>Navy Resources</h2>
            <ul className="resources-list">
              {NAVY_RESOURCES.map((resource, index) => (
                <li key={index}>
                  <a href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}</a>
                </li>
              ))}
            </ul>

            <h3>Success Tips</h3>
            <ul className="tips-list">
              {DETOX_TIPS.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>

            <div className="test-info">
              <button onClick={simulateTest} className="test-btn">Simulate Test</button>
            </div>
          </div>
        )}

        {/* Log History (shown on all tabs except resources and tests) */}
        {(activeTab !== 'resources' && activeTab !== 'tests') && (
          <div className="card">
            <h2>History</h2>
            {logs.length === 0 ? (
              <p className="empty-history">No entries yet. Start logging your journey.</p>
            ) : (
              <div className="log-entries">
                {logs.slice(0, 5).map(log => (
                  <div key={log.id} className="entry">
                    <div className="entry-header">
                      <span className="entry-date">{log.date} - {log.time}</span>
                      <button onClick={() => deleteLog(log.id)} className="delete-btn">DELETE</button>
                    </div>
                    <div className="entry-content">
                      <strong>Symptoms:</strong> {log.symptoms.join(', ') || 'None reported'}
                    </div>
                    <div className="entry-content">
                      <strong>Intensity:</strong> {log.intensity}/10
                    </div>
                    {log.notes && (
                      <div className="entry-content">
                        <strong>Notes:</strong> {log.notes}
                      </div>
                    )}
                  </div>
                ))}
                {logs.length > 5 && (
                  <button className="view-more-btn" onClick={() => alert("Feature coming soon: Complete history view")}>
                    View more entries ({logs.length - 5} more)
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;