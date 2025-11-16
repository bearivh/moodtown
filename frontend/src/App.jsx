import { useState } from 'react'
import Home from './pages/Home'
import Village from './pages/Village'
import WriteDiary from './pages/WriteDiary'
import Plaza from './pages/Plaza'
import Tree from './pages/Tree'
import Well from './pages/Well'
import Office from './pages/Office'
import Mailbox from './pages/Mailbox'
import Guide from './pages/Guide'
import { getTodayDateString } from './utils/dateUtils'
import './App.css'

function App() {
  const [currentPage, setCurrentPage] = useState('home')
  const [selectedDate, setSelectedDate] = useState(getTodayDateString())

  const handleNavigate = (page, date = null) => {
    if (date) {
      setSelectedDate(date)
    }
    setCurrentPage(page)
  }

  return (
    <div className="App">
      {currentPage === 'home' && <Home onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'guide' && <Guide onNavigate={handleNavigate} />}
      {currentPage === 'village' && <Village onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'write' && <WriteDiary onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'plaza' && <Plaza onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'tree' && <Tree onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'well' && <Well onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'office' && <Office onNavigate={handleNavigate} selectedDate={selectedDate} />}
      {currentPage === 'mailbox' && <Mailbox onNavigate={handleNavigate} selectedDate={selectedDate} />}
    </div>
  )
}

export default App
