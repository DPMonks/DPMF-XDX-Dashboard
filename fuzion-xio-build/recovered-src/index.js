import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// Import only once globally
import App from "./App";
import reportWebVitals from "./reportWebVitals";
import { Provider } from "react-redux";
import { createStore, applyMiddleware, compose } from "redux";
import thunk from "redux-thunk";
import rootReducers from "../src/store/rootReducers/index";
import overrideConsole from "./utilits/logger";

// src/index.js

// Start capturing logs
if (process.env.NODE_ENV === "production") {
  overrideConsole();
}

// --- Silence harmless ResizeObserver warnings globally ---
const resizeObserverErr =
  /ResizeObserver loop completed|ResizeObserver loop limit exceeded/;

const stopResizeObserverError = (event) => {
  if (resizeObserverErr.test(event.message)) {
    event.stopImmediatePropagation();
  }
};

window.addEventListener("error", stopResizeObserverError);
window.addEventListener("unhandledrejection", (event) => {
  if (
    event.reason &&
    typeof event.reason.message === "string" &&
    resizeObserverErr.test(event.reason.message)
  ) {
    event.preventDefault();
  }
});

const composeEnhancer = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;

const store = createStore(
  rootReducers,
  composeEnhancer(applyMiddleware(thunk))
);

const container = document.getElementById("root");
const root = createRoot(container);
root.render(
  <React.StrictMode>
    <Provider store={store}>
      <App />
    </Provider>
  </React.StrictMode>
);

// ReactDOM.render(
// 	<React.StrictMode>
// 		<Provider store={store}>
// 			<App />
// 		</Provider>
// 	</React.StrictMode>,
// 	document.getElementById('root')
// );

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
