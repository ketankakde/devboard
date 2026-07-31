{{- define "devboard.image" -}}
{{- $registry := .root.Values.global.imageRegistry -}}
{{- $repo := .repo -}}
{{- $tag := .root.Values.global.imageTag -}}
{{- printf "%s/%s:%s" $registry $repo $tag -}}
{{- end }}

{{- define "devboard.labels" -}}
app.kubernetes.io/managed-by: Helm
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end }}
