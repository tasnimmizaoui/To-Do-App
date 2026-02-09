# scripts/test-connectivity.sh
#!/bin/bash

echo "🔍 Testing Todo App Connectivity..."

echo "1. Testing Backend Service:"
kubectl run -it --rm --image=curlimages/curl test-backend-$(date +%s) -- \
  curl -s http://todo-backend-service:5000/health && echo "✅ Backend OK" || echo "❌ Backend FAILED"

echo ""
echo "2. Testing Frontend Service:"
kubectl run -it --rm --image=curlimages/curl test-frontend-$(date +%s) -- \
  curl -s http://todo-frontend-service:80 >/dev/null && echo "✅ Frontend OK" || echo "❌ Frontend FAILED"

echo ""
echo "3. Testing Ingress Routing:"
kubectl run -it --rm --image=curlimages/curl test-ingress-$(date +%s) -- \
  curl -s -H "Host: todo.local" http://ingress-nginx-controller.ingress-nginx/api/health >/dev/null && echo "✅ Ingress OK" || echo "❌ Ingress FAILED"

echo ""
echo "4. Checking Service Endpoints:"
kubectl get endpoints -n todo-dev

echo ""
echo "🌐 Quick Access Methods:"
echo "   A: kubectl port-forward -n todo-dev pod/todo-frontend-55b8d7b475-dzjlg 8080:3000"
echo "   B: kubectl port-forward -n todo-dev service/todo-frontend-service 8080:80"
echo "   C: minikube tunnel + http://todo.local"