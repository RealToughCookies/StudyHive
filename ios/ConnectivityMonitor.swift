import Foundation
import Network

/// iOS connectivity monitor using NWPathMonitor
/// Tracks network status and notifies the C++ engine selector
class ConnectivityMonitor: ObservableObject {
    @Published var isOnline: Bool = false
    @Published var connectionType: ConnectionType = .unknown
    
    private let monitor = NWPathMonitor()
    private let queue = DispatchQueue(label: "ConnectivityMonitor")
    
    // Callback to C++ engine selector
    private var statusCallback: ((Bool) -> Void)?
    
    enum ConnectionType {
        case unknown
        case wifi
        case cellular
        case ethernet
        case other
    }
    
    init() {
        startMonitoring()
    }
    
    deinit {
        monitor.cancel()
    }
    
    /// Start monitoring network connectivity
    func startMonitoring() {
        monitor.pathUpdateHandler = { [weak self] path in
            DispatchQueue.main.async {
                self?.updateConnectionStatus(path: path)
            }
        }
        monitor.start(queue: queue)
    }
    
    /// Stop monitoring network connectivity
    func stopMonitoring() {
        monitor.cancel()
    }
    
    /// Set callback for connectivity status changes
    func setStatusCallback(_ callback: @escaping (Bool) -> Void) {
        statusCallback = callback
    }
    
    /// Update connection status based on network path
    private func updateConnectionStatus(path: NWPath) {
        let wasOnline = isOnline
        isOnline = path.status == .satisfied
        
        // Update connection type
        if path.usesInterfaceType(.wifi) {
            connectionType = .wifi
        } else if path.usesInterfaceType(.cellular) {
            connectionType = .cellular
        } else if path.usesInterfaceType(.wiredEthernet) {
            connectionType = .ethernet
        } else if path.status == .satisfied {
            connectionType = .other
        } else {
            connectionType = .unknown
        }
        
        // Notify C++ engine selector if status changed
        if wasOnline != isOnline {
            statusCallback?(isOnline)
        }
        
        // Log connectivity changes for debugging
        print("ConnectivityMonitor: Status changed to \(isOnline ? "online" : "offline") via \(connectionType)")
    }
    
    /// Get current connectivity status
    func getCurrentStatus() -> (isOnline: Bool, connectionType: ConnectionType) {
        return (isOnline, connectionType)
    }
    
    /// Check if specific interface is available
    func isInterfaceAvailable(_ interfaceType: NWInterface.InterfaceType) -> Bool {
        return monitor.currentPath.usesInterfaceType(interfaceType)
    }
    
    /// Get detailed network information
    func getNetworkInfo() -> NetworkInfo {
        let path = monitor.currentPath
        return NetworkInfo(
            isOnline: path.status == .satisfied,
            connectionType: connectionType,
            availableInterfaces: getAvailableInterfaces(path: path),
            isExpensive: path.isExpensive,
            isConstrained: path.isConstrained
        )
    }
    
    /// Get available network interfaces
    private func getAvailableInterfaces(path: NWPath) -> [NWInterface.InterfaceType] {
        var interfaces: [NWInterface.InterfaceType] = []
        
        if path.usesInterfaceType(.wifi) {
            interfaces.append(.wifi)
        }
        if path.usesInterfaceType(.cellular) {
            interfaces.append(.cellular)
        }
        if path.usesInterfaceType(.wiredEthernet) {
            interfaces.append(.wiredEthernet)
        }
        if path.usesInterfaceType(.loopback) {
            interfaces.append(.loopback)
        }
        if path.usesInterfaceType(.other) {
            interfaces.append(.other)
        }
        
        return interfaces
    }
}

/// Network information structure
struct NetworkInfo {
    let isOnline: Bool
    let connectionType: ConnectivityMonitor.ConnectionType
    let availableInterfaces: [NWInterface.InterfaceType]
    let isExpensive: Bool
    let isConstrained: Bool
}

/// C++ bridge for connectivity monitoring
class ConnectivityBridge {
    private let monitor = ConnectivityMonitor()
    private var engineSelector: UnsafeMutableRawPointer?
    
    init() {
        // Set up callback to notify C++ engine selector
        monitor.setStatusCallback { [weak self] isOnline in
            self?.notifyEngineSelector(isOnline: isOnline)
        }
    }
    
    /// Set the C++ engine selector pointer
    func setEngineSelector(_ selector: UnsafeMutableRawPointer) {
        engineSelector = selector
    }
    
    /// Get current connectivity status
    func getCurrentStatus() -> Bool {
        return monitor.isOnline
    }
    
    /// Start monitoring
    func startMonitoring() {
        monitor.startMonitoring()
    }
    
    /// Stop monitoring
    func stopMonitoring() {
        monitor.stopMonitoring()
    }
    
    /// Notify C++ engine selector of status change
    private func notifyEngineSelector(isOnline: Bool) {
        guard let selector = engineSelector else { return }
        
        // Call C++ function to update connectivity status
        // This would be implemented in the C++ bridge
        updateConnectivityStatus(selector, isOnline)
    }
}

/// C function to update connectivity status in C++ engine selector
/// This function would be implemented in the C++ bridge
@_cdecl("updateConnectivityStatus")
func updateConnectivityStatus(_ selector: UnsafeMutableRawPointer, _ isOnline: Bool) {
    // Implementation would call the C++ EngineSelector::setConnectivityStatus
    // This is a placeholder for the actual C++ bridge implementation
    print("C++ Bridge: Updating connectivity status to \(isOnline ? "online" : "offline")")
}
