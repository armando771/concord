import { Component, type ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, spacing } from '../theme/tokens'
import { Button } from './Button'

interface Props {
  children: ReactNode
}

interface State {
  failed: boolean
}

/** Erro inesperado de renderização: tela de recuperação em vez de fechar o app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  private retry = (): void => this.setState({ failed: false })

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Algo deu errado</Text>
        <Button title="Tentar de novo" onPress={this.retry} />
      </View>
    )
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bgApp, justifyContent: 'center', padding: spacing.xl, gap: spacing.lg },
  title: { color: colors.textStrong, fontSize: fontSize.lg, fontWeight: '700', textAlign: 'center' }
})
