# Get the direct URL
minikube service -n todo-dev todo-frontend-lb --url

# This will output something like: http://127.0.0.1:xxxxx
# Open that URL in your browser