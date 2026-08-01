import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import useTranslation from '@/hooks/useTranslation';

const createNewGame = () => ({
    team1: {
        name: 'Team 1',
        score: 0,
        wickets: 0,
        overs: 0,
    },
    team2: {
        name: 'Team 2',
        score: 0,
        wickets: 0,
        overs: 0,
    },
    activeTeam: 1,
    status: 'notStarted',
    winner: null,
    startTime: null,
});

const calculateNextOver = (currentOvers) => {
    const fullOvers = Math.floor(currentOvers);
    const balls = Math.round((currentOvers - fullOvers) * 10) + 1;

    return balls === 6 ? fullOvers + 1 : fullOvers + (balls / 10);
};

const formatElapsedTime = (elapsedSeconds) => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const twoDigits = (value) => String(value).padStart(2, '0');

    return `${twoDigits(hours)}:${twoDigits(minutes)}:${twoDigits(seconds)}`;
};

export default function CricketScorerScreen() {
    const { t } = useTranslation();
    const [game, setGame] = useState(createNewGame);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [renamingTeamNumber, setRenamingTeamNumber] = useState(null);
    const [newTeamName, setNewTeamName] = useState('');

    useEffect(() => {
        if (game.status !== 'inProgress') {
            return undefined;
        }

        const interval = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - game.startTime) / 1000));
        }, 1000);

        return () => clearInterval(interval);
    }, [game.startTime, game.status]);

    const startGame = () => {
        setGame((currentGame) => ({
            ...currentGame,
            status: 'inProgress',
            startTime: Date.now(),
        }));
    };

    const addScore = (runs) => {
        setGame((currentGame) => {
            const activeTeamKey = currentGame.activeTeam === 1 ? 'team1' : 'team2';
            const activeTeam = currentGame[activeTeamKey];

            return {
                ...currentGame,
                [activeTeamKey]: {
                    ...activeTeam,
                    score: activeTeam.score + runs,
                    overs: calculateNextOver(activeTeam.overs),
                },
            };
        });
    };

    const addWicket = () => {
        setGame((currentGame) => {
            const activeTeamKey = currentGame.activeTeam === 1 ? 'team1' : 'team2';
            const activeTeam = currentGame[activeTeamKey];
            const wickets = activeTeam.wickets + 1;
            const nextGame = {
                ...currentGame,
                [activeTeamKey]: {
                    ...activeTeam,
                    wickets,
                },
            };

            if (currentGame.activeTeam === 1 && wickets >= 10) {
                return {
                    ...nextGame,
                    activeTeam: 2,
                };
            }

            if (currentGame.activeTeam === 2 && wickets >= 10) {
                const winner = currentGame.team1.score > currentGame.team2.score
                    ? 1
                    : currentGame.team2.score > currentGame.team1.score ? 2 : 0;

                return {
                    ...nextGame,
                    status: 'finished',
                    winner,
                };
            }

            return nextGame;
        });
    };

    const switchTeam = () => {
        setGame((currentGame) => ({
            ...currentGame,
            activeTeam: currentGame.activeTeam === 1 ? 2 : 1,
        }));
    };

    const resetGame = () => {
        setGame(createNewGame());
        setElapsedSeconds(0);
    };

    const openRenameDialog = (teamNumber) => {
        const team = teamNumber === 1 ? game.team1 : game.team2;
        setNewTeamName(team.name);
        setRenamingTeamNumber(teamNumber);
    };

    const saveTeamName = () => {
        const teamKey = renamingTeamNumber === 1 ? 'team1' : 'team2';

        setGame((currentGame) => ({
            ...currentGame,
            [teamKey]: {
                ...currentGame[teamKey],
                name: newTeamName,
            },
        }));
        setRenamingTeamNumber(null);
    };

    const winningText = game.winner === 0
        ? t('draw')
        : t('winner', {
            winner: game.winner === 1 ? game.team1.name : game.team2.name,
        });

    return (
        <SafeAreaView style={styles.safe} edges={['bottom']}>
            <Stack.Screen options={{ title: t('cricket_feature') }} />
            {game.status === 'notStarted' ? (
                <View style={styles.startScreen}>
                    <ScoreButton title={t('start_game')} onPress={startGame} />
                </View>
            ) : (
                <View style={styles.content}>
                    <View style={styles.timerSpace} />
                    <Text style={styles.timer}>{formatElapsedTime(elapsedSeconds)}</Text>
                    <View style={styles.timerSpace} />
                    <View style={styles.teamRow}>
                        <TouchableOpacity
                            style={styles.teamTouchTarget}
                            onPress={() => openRenameDialog(1)}
                            activeOpacity={0.8}
                        >
                            <TeamScore team={game.team1} isActive={game.activeTeam === 1} />
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.teamTouchTarget}
                            onPress={() => openRenameDialog(2)}
                            activeOpacity={0.8}
                        >
                            <TeamScore team={game.team2} isActive={game.activeTeam === 2} />
                        </TouchableOpacity>
                    </View>
                    {game.status === 'finished' && <Text style={styles.winner}>{winningText}</Text>}
                    <View style={styles.actionGap} />
                    {game.status === 'inProgress' && (
                        <View style={styles.actionGroup}>
                            <View style={styles.actionRow}>
                                {[1, 2, 3].map((runs) => (
                                    <ScoreButton
                                        key={runs}
                                        title={t('add_run', { run: runs })}
                                        onPress={() => addScore(runs)}
                                    />
                                ))}
                            </View>
                            <View style={styles.actionRow}>
                                {[4, 6].map((runs) => (
                                    <ScoreButton
                                        key={runs}
                                        title={t('add_run', { run: runs })}
                                        onPress={() => addScore(runs)}
                                    />
                                ))}
                            </View>
                            <ScoreButton title={t('add_wicket')} onPress={addWicket} />
                        </View>
                    )}
                    <View style={styles.actionGap} />
                    <View style={styles.footerActions}>
                        <ScoreButton title={t('reset_game')} onPress={resetGame} />
                        {game.status === 'inProgress' && (
                            <ScoreButton title={t('switch_team')} onPress={switchTeam} />
                        )}
                    </View>
                </View>
            )}
            <RenameTeamDialog
                visible={renamingTeamNumber !== null}
                value={newTeamName}
                onChangeText={setNewTeamName}
                onClose={() => setRenamingTeamNumber(null)}
                onSave={saveTeamName}
                t={t}
            />
        </SafeAreaView>
    );
}

function ScoreButton({ title, onPress }) {
    return (
        <TouchableOpacity style={styles.button} onPress={onPress} activeOpacity={0.8}>
            <Text style={styles.buttonText}>{title}</Text>
        </TouchableOpacity>
    );
}

function TeamScore({ team, isActive }) {
    return (
        <View style={[styles.teamCard, isActive && styles.activeTeamCard]}>
            <View style={styles.teamName}>
                <Text style={styles.teamNameText}>{team.name}</Text>
            </View>
            <View style={styles.score}>
                <Text style={styles.scoreText}>{`${team.score}/${team.wickets}`}</Text>
            </View>
        </View>
    );
}

function RenameTeamDialog({ visible, value, onChangeText, onClose, onSave, t }) {
    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable style={styles.dialogOverlay} onPress={onClose}>
                <Pressable style={styles.dialog} onPress={(event) => event.stopPropagation()}>
                    <View style={styles.dialogHeader}>
                        <Text style={styles.dialogTitle}>{t('rename_team')}</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Text style={styles.closeButtonText}>×</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        value={value}
                        onChangeText={onChangeText}
                        autoFocus
                        placeholder={t('enter_new_name')}
                        style={styles.input}
                    />
                    <View style={styles.dialogActions}>
                        <TouchableOpacity style={styles.outlineButton} onPress={onClose}>
                            <Text style={styles.outlineButtonText}>{t('cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.button} onPress={onSave}>
                            <Text style={styles.buttonText}>{t('save')}</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    safe: {
        flex: 1,
        backgroundColor: '#F4F5F8',
    },
    startScreen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        flex: 1,
    },
    timerSpace: {
        height: 40,
    },
    timer: {
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 48,
        fontWeight: '700',
        textAlign: 'center',
    },
    teamRow: {
        flexDirection: 'row',
    },
    teamTouchTarget: {
        flex: 1,
        marginHorizontal: 16,
    },
    teamCard: {
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#D6E4FF',
        borderRadius: 8,
    },
    activeTeamCard: {
        borderWidth: 2,
        borderColor: '#4A7DFF',
        shadowColor: '#4A7DFF',
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 3,
    },
    teamName: {
        paddingVertical: 8,
        backgroundColor: '#4A7DFF',
        alignItems: 'center',
    },
    teamNameText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    score: {
        paddingVertical: 24,
        backgroundColor: '#F5F8FF',
        alignItems: 'center',
    },
    scoreText: {
        color: '#4A7DFF',
        fontSize: 48,
        fontWeight: '700',
    },
    winner: {
        margin: 8,
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 24,
        fontWeight: '400',
        textAlign: 'center',
    },
    actionGap: {
        height: 20,
    },
    actionGroup: {
        alignItems: 'center',
        gap: 10,
    },
    actionRow: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
        alignSelf: 'stretch',
    },
    footerActions: {
        flexDirection: 'row',
        justifyContent: 'space-evenly',
    },
    button: {
        minHeight: 40,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 20,
        backgroundColor: '#4675F4',
        justifyContent: 'center',
        alignItems: 'center',
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '500',
    },
    dialogOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        padding: 24,
    },
    dialog: {
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
    },
    dialogHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dialogTitle: {
        color: 'rgba(0, 0, 0, 0.88)',
        fontSize: 22,
        fontWeight: '400',
    },
    closeButton: {
        width: 32,
        height: 32,
        alignItems: 'center',
        justifyContent: 'center',
    },
    closeButtonText: {
        color: '#1E1F21',
        fontSize: 24,
    },
    input: {
        height: 48,
        marginTop: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#8D93A6',
        color: '#1E1F21',
        fontSize: 16,
    },
    dialogActions: {
        marginTop: 24,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    outlineButton: {
        minHeight: 40,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#4675F4',
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    outlineButtonText: {
        color: '#4675F4',
        fontSize: 14,
        fontWeight: '500',
    },
});
