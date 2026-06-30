export default function Pools({ data }) {
  // Loading state handled by App.jsx (it waits for poolStats)
  if (!data) {
    return <p>Loading pools...</p>;
  }

  // No pools returned
  if (data.length === 0) {
    return <p>No pools found.</p>;
  }

  return (
    <div>
      <h2>Liquidity Pools</h2>

      {data.map((pool, i) => (
        <div key={i} className="pool-row">
          <strong>
            {pool.tokenA}/{pool.tokenB}
          </strong>
          <p>Liquidity: {pool.liquidity}</p>
        </div>
      ))}
    </div>
  );
}
