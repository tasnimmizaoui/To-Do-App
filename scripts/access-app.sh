#THis is for my local Dev enironment where i'm using WSL and minikube with docker driver which can face some limitations when it comes to networking 
#!/bin/bash

echo "🚀 STARTING WORKING ACCESS..."

echo "1. Starting Port Forwarding..."
kubectl port-forward -n todo-dev service/todo-frontend-service 8080:80 &
PF_PID=$!

echo "2. Waiting for port forward to establish..."
sleep 3

echo "3. Testing Access..."
if curl -s http://localhost:8080/api/health >/dev/null; then
    echo "✅ SUCCESS! Your app is accessible at:"
    echo "   🌐 http://localhost:8080"
    echo ""
    echo "📝 Keep this terminal running and open the URL in your Windows browser"
    echo ""
    echo "To stop access, press Ctrl+C in this terminal"
    
    # Keep the port forward running
    wait $PF_PID
else
    echo "❌ Port forwarding failed, trying direct pod access..."
    kill $PF_PID 2>/dev/null
    
    # Try direct pod access
    POD_NAME=$(kubectl get pods -n todo-dev -l app=todo-frontend -o jsonpath='{.items[0].metadata.name}')
    kubectl port-forward -n todo-dev pod/$POD_NAME 8081:3000 &
    echo "✅ Alternative access: http://localhost:8081"
    wait
fi