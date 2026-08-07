import React, { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // You can send error info to a monitoring service here
    console.error('ErrorBoundary caught an error', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="bg-white rounded-lg shadow-lg p-6 max-w-xl w-full text-center">
            <h2 className="text-xl font-semibold text-red-600 mb-2">Une erreur est survenue</h2>
            <p className="text-gray-700 mb-4">{error?.message || 'Erreur inconnue'}</p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={() => this.setState({ error: null })}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >Réessayer</button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >Recharger</button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
