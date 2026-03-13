import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import SharedExpenses from './components/SharedExpenses';
import Settlements from './components/Settlements';
import PersonalExpenses from './components/PersonalExpenses';
import Members from './components/Members';

export default function App() {
  return (
    <ThemeProvider>
      <Router>
        <div className="min-h-screen">
          <Sidebar />
          <main className="lg:pl-64 min-h-screen pt-16 lg:pt-0">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/shared" element={<SharedExpenses />} />
              <Route path="/settlements" element={<Settlements />} />
              <Route path="/personal" element={<PersonalExpenses />} />
              <Route path="/members" element={<Members />} />
            </Routes>
          </main>
        </div>
      </Router>
    </ThemeProvider>
  );
}
