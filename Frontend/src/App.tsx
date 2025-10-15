import { Route, Routes } from "react-router-dom";
import Dashboard from "./Dashboard";
import Homepage from "./Homepage";



const App = () => {
  return (
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App
