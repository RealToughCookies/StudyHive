package com.studyhive.core

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * Android connectivity monitor using ConnectivityManager.NetworkCallback
 * Tracks network status and notifies the C++ engine selector
 */
class ConnectivityMonitor private constructor(private val context: Context) {
    
    private val connectivityManager = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    private var networkCallback: ConnectivityManager.NetworkCallback? = null
    private var statusCallback: ((Boolean) -> Unit)? = null
    
    @Volatile
    private var isOnline: Boolean = false
    
    @Volatile
    private var connectionType: ConnectionType = ConnectionType.UNKNOWN
    
    enum class ConnectionType {
        UNKNOWN, WIFI, CELLULAR, ETHERNET, OTHER
    }
    
    companion object {
        @Volatile
        private var INSTANCE: ConnectivityMonitor? = null
        
        fun getInstance(context: Context): ConnectivityMonitor {
            return INSTANCE ?: synchronized(this) {
                INSTANCE ?: ConnectivityMonitor(context.applicationContext).also { INSTANCE = it }
            }
        }
    }
    
    /**
     * Start monitoring network connectivity
     */
    fun startMonitoring() {
        if (networkCallback != null) {
            return // Already monitoring
        }
        
        networkCallback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                super.onAvailable(network)
                updateConnectionStatus()
            }
            
            override fun onLost(network: Network) {
                super.onLost(network)
                updateConnectionStatus()
            }
            
            override fun onCapabilitiesChanged(network: Network, networkCapabilities: NetworkCapabilities) {
                super.onCapabilitiesChanged(network, networkCapabilities)
                updateConnectionStatus()
            }
        }
        
        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .build()
        
        connectivityManager.registerNetworkCallback(networkRequest, networkCallback!!)
        
        // Get initial status
        updateConnectionStatus()
    }
    
    /**
     * Stop monitoring network connectivity
     */
    fun stopMonitoring() {
        networkCallback?.let { callback ->
            connectivityManager.unregisterNetworkCallback(callback)
            networkCallback = null
        }
    }
    
    /**
     * Set callback for connectivity status changes
     */
    fun setStatusCallback(callback: (Boolean) -> Unit) {
        statusCallback = callback
    }
    
    /**
     * Update connection status based on current network state
     */
    private fun updateConnectionStatus() {
        val wasOnline = isOnline
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val network = connectivityManager.activeNetwork
            val capabilities = connectivityManager.getNetworkCapabilities(network)
            
            isOnline = capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
            
            // Determine connection type
            connectionType = when {
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_WIFI) == true -> ConnectionType.WIFI
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR) == true -> ConnectionType.CELLULAR
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_ETHERNET) == true -> ConnectionType.ETHERNET
                capabilities?.hasTransport(NetworkCapabilities.TRANSPORT_BLUETOOTH) == true -> ConnectionType.OTHER
                else -> ConnectionType.UNKNOWN
            }
        } else {
            // Fallback for older Android versions
            @Suppress("DEPRECATION")
            val networkInfo = connectivityManager.activeNetworkInfo
            isOnline = networkInfo?.isConnected == true
            
            @Suppress("DEPRECATION")
            connectionType = when (networkInfo?.type) {
                ConnectivityManager.TYPE_WIFI -> ConnectionType.WIFI
                ConnectivityManager.TYPE_MOBILE -> ConnectionType.CELLULAR
                ConnectivityManager.TYPE_ETHERNET -> ConnectionType.ETHERNET
                else -> ConnectionType.UNKNOWN
            }
        }
        
        // Notify C++ engine selector if status changed
        if (wasOnline != isOnline) {
            statusCallback?.invoke(isOnline)
        }
        
        // Log connectivity changes for debugging
        android.util.Log.d("ConnectivityMonitor", "Status changed to ${if (isOnline) "online" else "offline"} via $connectionType")
    }
    
    /**
     * Get current connectivity status
     */
    fun getCurrentStatus(): Pair<Boolean, ConnectionType> {
        return Pair(isOnline, connectionType)
    }
    
    /**
     * Check if specific transport is available
     */
    @RequiresApi(Build.VERSION_CODES.M)
    fun isTransportAvailable(transport: Int): Boolean {
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        return capabilities?.hasTransport(transport) == true
    }
    
    /**
     * Get detailed network information
     */
    fun getNetworkInfo(): NetworkInfo {
        return NetworkInfo(
            isOnline = isOnline,
            connectionType = connectionType,
            isExpensive = isConnectionExpensive(),
            isConstrained = isConnectionConstrained()
        )
    }
    
    /**
     * Check if connection is expensive (e.g., cellular data)
     */
    @RequiresApi(Build.VERSION_CODES.M)
    private fun isConnectionExpensive(): Boolean {
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        return capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) != true
    }
    
    /**
     * Check if connection is constrained (e.g., low bandwidth)
     */
    @RequiresApi(Build.VERSION_CODES.M)
    private fun isConnectionConstrained(): Boolean {
        val network = connectivityManager.activeNetwork
        val capabilities = connectivityManager.getNetworkCapabilities(network)
        return capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_RESTRICTED) != true
    }
}

/**
 * Network information data class
 */
data class NetworkInfo(
    val isOnline: Boolean,
    val connectionType: ConnectivityMonitor.ConnectionType,
    val isExpensive: Boolean,
    val isConstrained: Boolean
)

/**
 * C++ bridge for connectivity monitoring
 */
class ConnectivityBridge {
    private val monitor: ConnectivityMonitor
    private var engineSelector: Long = 0 // C++ pointer as Long
    
    constructor(context: Context) {
        monitor = ConnectivityMonitor.getInstance(context)
        
        // Set up callback to notify C++ engine selector
        monitor.setStatusCallback { isOnline ->
            notifyEngineSelector(isOnline)
        }
    }
    
    /**
     * Set the C++ engine selector pointer
     */
    fun setEngineSelector(selector: Long) {
        engineSelector = selector
    }
    
    /**
     * Get current connectivity status
     */
    fun getCurrentStatus(): Boolean {
        return monitor.getCurrentStatus().first
    }
    
    /**
     * Start monitoring
     */
    fun startMonitoring() {
        monitor.startMonitoring()
    }
    
    /**
     * Stop monitoring
     */
    fun stopMonitoring() {
        monitor.stopMonitoring()
    }
    
    /**
     * Notify C++ engine selector of status change
     */
    private fun notifyEngineSelector(isOnline: Boolean) {
        if (engineSelector != 0L) {
            // Call C++ function to update connectivity status
            // This would be implemented in the C++ bridge
            updateConnectivityStatus(engineSelector, isOnline)
        }
    }
}

/**
 * External C++ function to update connectivity status in engine selector
 * This function would be implemented in the C++ bridge
 */
external fun updateConnectivityStatus(selector: Long, isOnline: Boolean)

/**
 * Companion object for native library loading
 */
object ConnectivityBridgeNative {
    init {
        System.loadLibrary("studyhive_core")
    }
}
