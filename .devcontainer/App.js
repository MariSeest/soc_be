import React, { useEffect, useState } from 'react';

function App() {
    const [data, setData] = useState(null);
    const apiUrl = process.env.REACT_APP_API_URL;

    useEffect(() => {
        fetch(`${apiUrl}/data`)
            .then(response => response.json())
            .then(data => setData(data))
            .catch(error => console.error('Error fetching data:', error));
    }, [apiUrl]);

    return (
        <div className="App">
            <header className="App-header">
                {data ? <p>{data.message}</p> : <p>Loading...</p>}
            </header>
        </div>
    );
}

export default App;
