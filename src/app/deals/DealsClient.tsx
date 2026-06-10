'use client';

import { useState, useEffect } from 'react';
import styles from './Deals.module.css';
import { updateDealStatus, updateDealMortgage,
  getDealClients,
  addDealClient,
  removeDealClient,
  setPrimaryClient,
  getDealUnits,
  addDealUnit,
  removeDealUnit,
  searchLeads,
  searchUnits } from '@/app/actions/deals';
import { logCallAttempt } from '@/app/actions/leads';
import { useRouter } from 'next/navigation';

type StageType = 'normal' | 'group' | 'child';

// Строго 14 этапов в соответствии с разделом 3 ОП.pdf (страница 13)
const STAGES: { id: string; label: string; color: string; type: StageType; children?: string[] }[] = [
  { id: 'NEW_LEAD', label: 'Новый лид', color: '#6366f1', type: 'normal' },
  { id: 'CLARIFICATION', label: 'Уточнение', color: '#818cf8', type: 'normal' },
  
  // Группа Звонок (одна колонка в Kanban, ТЗ 8.1.2)
  { id: 'CALL_GROUP', label: 'Звонок', color: '#3b82f6', type: 'group', children: ['CALL', 'SECOND_CALL', 'THIRD_CALL'] },
  { id: 'CALL', label: '1-й звонок', color: '#3b82f6', type: 'child' },
  { id: 'SECOND_CALL', label: 'Второй звонок', color: '#2563eb', type: 'child' },
  { id: 'THIRD_CALL', label: 'Третий звонок', color: '#1d4ed8', type: 'child' },
  
  { id: 'CONSULTATION', label: 'Личная консультация', color: '#f59e0b', type: 'normal' },
  { id: 'PRE_RESERVATION', label: 'Бронирование (Soft)', color: '#fbbf24', type: 'normal' },
  { id: 'RESERVATION', label: 'Предв. бронирование (Hard)', color: '#f97316', type: 'normal' },
  { id: 'CONTRACT_PREPARATION', label: 'Готовность к сделке', color: '#a855f7', type: 'normal' },
  { id: 'CONTRACT', label: 'Документ сформирован', color: '#0d9488', type: 'normal' },
  { id: 'CLIENT_CONFIRMATION', label: 'Подтверждено клиентом', color: '#059669', type: 'normal' },
  { id: 'WAITING_PAYMENT', label: 'Ожидание оплаты', color: '#ec4899', type: 'normal' },
  { id: 'PAYMENT_CONFIRMED', label: 'Оплата подтверждена', color: '#db2777', type: 'normal' },
  
  { id: 'SUCCESS', label: 'Won (успешно)', color: '#15803d', type: 'normal' },
  { id: 'FAILED', label: 'Lost (отказ)', color: '#ef4444', type: 'normal' },
  { id: 'CANCELLED', label: 'Cancelled (расторжение)', color: '#64748b', type: 'normal' }
];

interface DealsClientProps {
  initialDeals: any[];
  organizationId: string;
}

export default function DealsClient({ initialDeals, organizationId }: DealsClientProps) {
  const router = useRouter();
  const [deals, setDeals] = useState(initialDeals);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({ CALL_GROUP: true });
  const [selectedDeal, setSelectedDeal] = useState<any | null>(null);
  
  // Поля для редактирования ипотеки в модалке
  const [mortgageBank, setMortgageBank] = useState('');
  const [mortgageStatus, setMortgageStatus] = useState('NONE');
  const [mortgageComment, setMortgageComment] = useState('');
  const [loading, setLoading] = useState(false);

  // Состояния для множественных клиентов и объектов
const [dealClients, setDealClients] = useState<any[]>([]);
const [dealUnits, setDealUnits] = useState<any[]>([]);
const [showAddClientModal, setShowAddClientModal] = useState(false);
const [showAddUnitModal, setShowAddUnitModal] = useState(false);
const [showRemoveUnitModal, setShowRemoveUnitModal] = useState<{ id: string; number: string } | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<any[]>([]);
const [searchLoading, setSearchLoading] = useState(false);
const [selectedClient, setSelectedClient] = useState<any>(null);
const [selectedUnit, setSelectedUnit] = useState<any>(null);
const [isPrimaryClient, setIsPrimaryClient] = useState(false);
const [deleteReason, setDeleteReason] = useState('');
const [customDeleteReason, setCustomDeleteReason] = useState('');

  useEffect(() => {
    setDeals(initialDeals);
  }, [initialDeals]);

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    e.dataTransfer.setData('text/plain', dealId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetStageId: string) => {
    e.preventDefault();
    const dealId = e.dataTransfer.getData('text/plain');
    if (!dealId) return;

    const targetStage = targetStageId === 'CALL_GROUP' ? 'CALL' : targetStageId;

    const originalDeals = [...deals];
    setDeals(prev => 
      prev.map(d => d.id === dealId ? { ...d, status: targetStage } : d)
    );

    const res = await updateDealStatus(dealId, targetStage);
    if (!res.success) {
      alert(res.message || 'Ошибка при обновлении статуса сделки в БД!');
      setDeals(originalDeals);
    } else {
      router.refresh();
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const calculateConversion = (count: number) => {
    const total = deals.length;
    return total > 0 ? Math.round((count / total) * 100) : 0;
  };

// Загрузить дополнительных клиентов и объекты для сделки
const loadDealExtras = async (dealId: string) => {
  const clients = await getDealClients(dealId);
  const units = await getDealUnits(dealId);
  setDealClients(clients);
  setDealUnits(units);
};

// Обновленный handleCardClick
const handleCardClick = async (deal: any) => {
  setSelectedDeal(deal);
  setMortgageBank(deal.mortgageBank || '');
  setMortgageStatus(deal.mortgageStatus || 'NONE');
  setMortgageComment(deal.mortgageComment || '');
  await loadDealExtras(deal.id);
};

const UNIT_DELETE_REASONS = [
  'Клиент передумал',
  'Не подходит по планировке',
  'Не подходит по бюджету',
  'Квартира уже продана',
  'Не устраивает срок сдачи',
  'Другое'
];

  // Сохранение ипотеки
  const handleSaveMortgage = async () => {
    if (!selectedDeal) return;
    setLoading(true);
    const res = await updateDealMortgage({
      dealId: selectedDeal.id,
      bank: mortgageBank,
      status: mortgageStatus,
      comment: mortgageComment
    });
    if (res.success) {
      alert('Ипотечный статус успешно сохранен!');
      setSelectedDeal({
        ...selectedDeal,
        mortgageBank,
        mortgageStatus,
        mortgageComment
      });
      router.refresh();
    } else {
      alert('Ошибка при сохранении статуса ипотеки');
    }
    setLoading(false);
  };

  // Кнопка быстрого звонка в Kanban
  const handleQuickCall = async (e: React.MouseEvent, deal: any) => {
    e.stopPropagation();
    const res = await logCallAttempt(deal.lead?.id || deal.id);
    if (res.success) {
      // Инкрементируем статус звонка в соответствии с ТЗ 8.1.2: 1-й -> 2-й -> 3-й
      let nextStatus = deal.status;
      if (deal.status === 'CALL') nextStatus = 'SECOND_CALL';
      else if (deal.status === 'SECOND_CALL') nextStatus = 'THIRD_CALL';
      
      if (nextStatus !== deal.status) {
        await updateDealStatus(deal.id, nextStatus);
      }
      
      if (res.attempts >= 3) {
        alert('Достигнуто 3 попытки звонка без ответа. Рекомендуется перевести сделку в статус LOST.');
      }
      router.refresh();
    }
  };

  // Поиск лидов
const handleSearchLeads = async () => {
  if (!searchQuery.trim()) return;
  setSearchLoading(true);
  const results = await searchLeads(organizationId, searchQuery);
  setSearchResults(results);
  setSearchLoading(false);
};

// Добавить клиента
const handleAddClient = async () => {
  if (!selectedClient || !selectedDeal) return;
  const res = await addDealClient(selectedDeal.id, selectedClient.id, isPrimaryClient);
  if (res.success) {
    await loadDealExtras(selectedDeal.id);
    setShowAddClientModal(false);
    setSelectedClient(null);
    setSearchQuery('');
    setSearchResults([]);
    alert('Клиент добавлен в сделку');
  } else {
    alert(res.message || 'Ошибка при добавлении клиента');
  }
};

// Поиск объектов
const handleSearchUnits = async () => {
  if (!searchQuery.trim()) return;
  setSearchLoading(true);
  const results = await searchUnits(organizationId, searchQuery);
  setSearchResults(results);
  setSearchLoading(false);
};

// Добавить объект
const handleAddUnit = async () => {
  if (!selectedUnit || !selectedDeal) return;
  const res = await addDealUnit(selectedDeal.id, selectedUnit.id);
  if (res.success) {
    await loadDealExtras(selectedDeal.id);
    setShowAddUnitModal(false);
    setSelectedUnit(null);
    setSearchQuery('');
    setSearchResults([]);
    alert('Объект добавлен в сделку');
  } else {
    alert(res.message || 'Ошибка при добавлении объекта');
  }
};

// Удалить объект с причиной
const handleRemoveUnit = async () => {
  if (!showRemoveUnitModal) return;
  const finalReason = deleteReason === 'Другое' ? customDeleteReason : deleteReason;
  if (!finalReason) {
    alert('Укажите причину удаления');
    return;
  }
  const res = await removeDealUnit(showRemoveUnitModal.id, deleteReason, customDeleteReason);
  if (res.success) {
    await loadDealExtras(selectedDeal!.id);
    router.refresh();
    setShowRemoveUnitModal(null);
    setDeleteReason('');
    setCustomDeleteReason('');
    alert('Объект удален из сделки');
  } else {
    alert('Ошибка при удалении объекта');
  }
};

// Сменить основного клиента
const handleSetPrimaryClient = async (leadId: string) => {
  if (!selectedDeal) return;
  
  // Находим данные нового основного клиента
  const newPrimaryClient = dealClients.find(c => c.leadId === leadId);
  if (!newPrimaryClient) return;
  
  // Обновляем в базе данных
  const res = await setPrimaryClient(selectedDeal.id, leadId);
  
  if (res.success) {
    // Обновляем локальный state selectedDeal
    setSelectedDeal({
      ...selectedDeal,
      lead: {
        id: newPrimaryClient.leadId,
        name: newPrimaryClient.name,
        phone: newPrimaryClient.phone,
        email: newPrimaryClient.email,
        iin: newPrimaryClient.iin
      },
      clientName: newPrimaryClient.name
    });
    
    // Перезагружаем список клиентов
    await loadDealExtras(selectedDeal.id);
    alert('Основной клиент изменен');
  }
};

  return (
    <div className={styles.kanbanWrapper}>
      <header style={{marginBottom: '20px'}}>
        <h1 style={{fontSize: '2rem', fontWeight: 800, color: '#1e293b'}}></h1>
        <p style={{color: '#64748b', fontSize: '0.95rem'}}></p>
      </header>

      <div className={styles.kanbanBoardVertical}>
        {STAGES.map((stage) => {
          if (stage.type === 'child') return null;

          let stageDeals: any[] = [];
          if (stage.type === 'group' && stage.children) {
            stageDeals = deals.filter(d => stage.children?.includes(d.status));
          } else {
            stageDeals = deals.filter(d => d.status === stage.id);
          }

          const conversion = calculateConversion(stageDeals.length);
          // По ТЗ деньги суммируем только со стадии Личная консультация (CONSULTATION, ранг >= 5)
          const isFinancialStage = stage.id !== 'NEW_LEAD' && stage.id !== 'CLARIFICATION' && stage.id !== 'CALL_GROUP';
          const stageRevenue = isFinancialStage 
            ? stageDeals.reduce((sum, deal) => sum + (deal.unit?.price || 0), 0)
            : 0;

          return (
            <div
              key={stage.id}
              className={`${styles.verticalStage} ${stage.type === 'group' ? styles.groupStage : ''}`}
            >
              <div
                className={styles.stageHeader}
                style={{ borderLeftColor: stage.color }}
                onClick={stage.type === 'group' ? () => toggleGroup(stage.id) : undefined}
              >
                <div className={styles.stageMainInfo}>
                  {stage.type === 'group' && (
                    <span className={styles.expandArrow}>
                      {expandedGroups[stage.id] ? '▼' : '▶'}
                    </span>
                  )}
                  <h4>{stage.label}</h4>
                  <span className={styles.countBadge}>{stageDeals.length}</span>
                </div>

                <div className={styles.stageStats}>
                  {isFinancialStage && (
                    <span className={styles.revenue}>${stageRevenue.toLocaleString()}</span>
                  )}
                  <span className={styles.conversion}>{conversion}%</span>
                </div>
              </div>

              <div 
                className={styles.verticalCardList}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, stage.id)}
              >
                {stageDeals.length > 0 ? (
                  stageDeals.map((deal) => {
                    const daysInStatus = Math.floor((Date.now() - new Date(deal.updatedAt).getTime()) / (1000 * 60 * 60 * 24));
                    const isSlaOverdue = daysInStatus >= 3; // SLA 3 дня на статус по умолчанию
                    

                    return (
                      <div 
                        key={deal.id} 
                        className={styles.dealCardVertical}
                        draggable
                        onDragStart={(e) => handleDragStart(e, deal.id)}
                        onClick={() => handleCardClick(deal)}
                      >
                        <div className={styles.cardHeaderSmall}>
                          <span className={styles.unitTagSmall}>{deal.unit?.number ? `№${deal.unit.number}` : 'Без объекта'}</span>
                          <span className={styles.dealIdSmall}>#{deal.id.slice(0, 6)}</span>
                        </div>
                        <div className={styles.clientNameSmall}>{deal.clientName || 'Без имени'}</div>
                        
                        <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px'}}>
                          <span className={styles.priceTagSmall}>
                            {deal.unit?.price ? `$${deal.unit.price.toLocaleString()}` : '—'}
                          </span>
                          
                          {/* SLA тикер дней на этапе */}
                          <span style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: '4px',
                            backgroundColor: isSlaOverdue ? '#fee2e2' : '#f1f5f9',
                            color: isSlaOverdue ? '#ef4444' : '#64748b'
                          }}>
                            ⏱ {daysInStatus} дн.
                          </span>
                        </div>

                        {/* Звонки и под-статусы ТЗ 8.1.2 */}
                        {stage.id === 'CALL_GROUP' && (
                          <div style={{marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                            <span style={{
                              fontSize: '0.75rem',
                              fontWeight: 800,
                              fontSize: '1.25rem',
                              color: '#2563eb',
                              background: '#eff6ff',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              {deal.status === 'CALL' ? '1-й звонок' : deal.status === 'SECOND_CALL' ? '2-й звонок' : '3-й звонок'}
                            </span>
                            <button 
                              className={styles.quickCallBtn}
                              onClick={(e) => handleQuickCall(e, deal)}
                            >
                              ☎️ Набрать
                            </button>
                          </div>
                        )}

                        {/* Отображение статуса ипотеки на карточке */}
                        {deal.mortgageStatus && deal.mortgageStatus !== 'NONE' && (
                          <div style={{marginTop: '8px', display: 'flex', gap: '5px'}}>
                            <span style={{
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              background: deal.mortgageStatus === 'APPROVED' ? '#d1fae5' : deal.mortgageStatus === 'REJECTED' ? '#fee2e2' : '#fef3c7',
                              color: deal.mortgageStatus === 'APPROVED' ? '#065f46' : deal.mortgageStatus === 'REJECTED' ? '#991b1b' : '#92400e',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              textTransform: 'uppercase'
                            }}>
                              🏦 {deal.mortgageBank}: {deal.mortgageStatus === 'APPROVED' ? 'Одобрено' : deal.mortgageStatus === 'REJECTED' ? 'Отказ' : 'На рассмотрении'}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.emptyStage}>Нет сделок</div>
                )}
              </div>

              {/* Отображение развернутой группы для Звонков */}
              {stage.type === 'group' && expandedGroups[stage.id] && stage.children && (
                <div className={styles.childStages}>
                  {stage.children.map((childId) => {
                    const child = STAGES.find((s) => s.id === childId);
                    const childDeals = deals.filter((d) => d.status === childId);

                    return (
                      <div key={childId} className={styles.childStageCard}>
                        <div
                          className={styles.stageHeader}
                          style={{ borderLeftColor: child?.color }}
                        >
                          <div className={styles.stageMainInfo}>
                            <span className={styles.childLine}>↓</span>
                            <h4>{child?.label}</h4>
                            <span className={styles.countBadge}>{childDeals.length}</span>
                          </div>
                        </div>

                        <div 
                          className={styles.verticalCardList}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, childId)}
                        >
                          {childDeals.length > 0 ? (
                            childDeals.map((deal) => (
                              <div 
                                key={deal.id} 
                                className={styles.dealCardVertical}
                                draggable
                                onDragStart={(e) => handleDragStart(e, deal.id)}
                                onClick={() => handleCardClick(deal)}
                              >
                                <div className={styles.cardHeaderSmall}>
                                  <span className={styles.unitTagSmall}>{deal.unit?.number ? `№${deal.unit.number}` : 'Без объекта'}</span>
                                  <span className={styles.dealIdSmall}>
                                    #{deal.id.slice(0, 6)}
                                  </span>
                                </div>

                                <div className={styles.clientNameSmall}>
                                  {deal.clientName || 'Без имени'}
                                </div>

                                <div className={styles.priceTagSmall}>
                                  {deal.unit?.price ? `$${deal.unit.price.toLocaleString()}` : '—'}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className={styles.emptyStage}>Нет сделок</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Модальное окно деталей сделки с блоком Ипотеки */}
      {selectedDeal && (
        <div className={styles.overlay} onClick={() => setSelectedDeal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <header className={styles.modalHeader}>
              <h2 style={{fontWeight: 800, color: '#0f172a', fontSize: '1.7rem'}}>Карточка сделки #{selectedDeal.id.slice(0, 8)}</h2>
              <button className={styles.closeBtn} onClick={() => setSelectedDeal(null)}>✕</button>
            </header>

            <main className={styles.modalBody}>
  {/* БЛОК ДАННЫЕ КЛИЕНТА С ПЛЮСИКОМ */}
  <div className={styles.infoSection}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '5px', margin: 0 }}>
        👤 Данные клиента
      </h3>
      <button 
        className={styles.quickCallBtn}
        onClick={() => {
          setSearchQuery('');
          setSearchResults([]);
          setSelectedClient(null);
          setIsPrimaryClient(false);
          setShowAddClientModal(true);
        }}
        style={{ fontSize: '1.2rem', padding: '4px 12px' }}
      >
        +
      </button>
    </div>

    {/* Основной клиент (из сделки) */}
    <div style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <strong style={{
    fontSize: '1.2rem',
    color: '#0f172a'
  }}>{selectedDeal.clientName || '—'}</strong>
          <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '8px' }}>
            ОСНОВНОЙ
          </span>
          <div
  style={{
    fontSize: '1rem',
    color: '#475569',
    marginTop: '4px'
  }}
>{selectedDeal.lead?.phone || '—'}</div>
          <div
  style={{
    fontSize: '1rem',
    color: '#475569'
  }}
>{selectedDeal.lead?.email || '—'}</div>
        </div>
      </div>
    </div>

    {/* Дополнительные клиенты */}
    {dealClients.filter(c => c.leadId !== selectedDeal.lead?.id).map(client => (
      <div key={client.id} style={{ padding: '10px 0', borderBottom: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{client.name}</strong>
            {client.isPrimary && (
              <span style={{ background: '#d1fae5', color: '#065f46', padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', marginLeft: '8px' }}>
                ОСНОВНОЙ
              </span>
            )}
            <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{client.phone}</div>
            {client.email && <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{client.email}</div>}
          </div>
          <div>
            {!client.isPrimary && (
              <button 
                className={styles.quickCallBtn}
                style={{ marginRight: '8px' }}
                onClick={() => handleSetPrimaryClient(client.leadId)}
              >
                Сделать основным
              </button>
            )}
            <button 
              className={styles.quickCallBtn}
              style={{ background: '#fee2e2', color: '#ef4444' }}
              onClick={async () => {
                if (confirm('Удалить клиента из сделки?')) {
                  await removeDealClient(client.id);
                  await loadDealExtras(selectedDeal.id);
                }
              }}
            >
              ✕
            </button>
          </div>
        </div>
      </div>
    ))}
  </div>

  {/* БЛОК ОБЪЕКТ НЕДВИЖИМОСТИ С ПЛЮСИКОМ */}
  <div className={styles.infoSection}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
      <h3 style={{ fontWeight: 800, fontSize: '1.25rem', color: '#1e293b', borderBottom: '1px solid #f1f5f9', paddingBottom: '5px', margin: 0 }}>
        🏢 Объект недвижимости
      </h3>
      <button 
        className={styles.quickCallBtn}
        onClick={() => {
          setSearchQuery('');
          setSearchResults([]);
          setSelectedUnit(null);
          setShowAddUnitModal(true);
        }}
        style={{ fontSize: '1.2rem', padding: '4px 12px' }}
      >
        +
      </button>
    </div>

    {/* Основной объект (из сделки) */}
    {selectedDeal.unit ? (
      <div style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px' }}>
        <div>
          <strong>{selectedDeal.unit.projectName || 'ЖК'}</strong> – №{selectedDeal.unit.number}
          <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
            {selectedDeal.unit.rooms} комн. • {selectedDeal.unit.area} м² • ${selectedDeal.unit.price?.toLocaleString()}
          </div>
        </div>
      </div>
    ) : (
      <p style={{ color: '#94a3b8', fontStyle: 'italic' }}>Квартира к сделке еще не привязана</p>
    )}

    {/* Дополнительные объекты */}
    {dealUnits.map(unit => (
      <div key={unit.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '8px', marginBottom: '8px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <strong>{unit.projectName}</strong> – №{unit.number}
            <div style={{ fontSize: '0.85rem', color: '#64748b' }}>
              {unit.rooms} комн. • {unit.area} м² • ${Number(unit.price).toLocaleString()}
            </div>
          </div>
          <button 
            className={styles.quickCallBtn}
            style={{ background: '#fee2e2', color: '#ef4444' }}
            onClick={() => setShowRemoveUnitModal({ id: unit.id, number: unit.number })}
          >
            Удалить
          </button>
        </div>
      </div>
    ))}
  </div>

  {/* Блок Ипотека (остается без изменений) */}
  <div className={styles.infoSection} style={{ background: 'rgba(59, 130, 246, 0.03)', border: '1px solid rgba(59, 130, 246, 0.1)', padding: '15px', borderRadius: '10px' }}>
    <h3 style={{ fontWeight: 800, marginBottom: '12px', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
      🏦 Блок «Ипотека» (Статус одобрения)
    </h3>
    
    <div style={{ display: 'flex', gap: '15px', marginBottom: '12px' }}>
      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, fontSize: '1.25rem', color: '#475569', marginBottom: '5px' }}>Выбор банка</label>
        <select 
          className={styles.modalInput} 
          value={mortgageBank} 
          onChange={e => setMortgageBank(e.target.value)}
        >
          <option value="">Не выбрано</option>
          <option value="TBC Bank">TBC Bank</option>
          <option value="Bank of Georgia">Bank of Georgia</option>
          <option value="VTB Bank">VTB Bank</option>
          <option value="Other Bank">Другой банк</option>
        </select>
      </div>

      <div style={{ flex: 1 }}>
        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, fontSize: '1.25rem', color: '#475569', marginBottom: '5px' }}>Статус одобрения</label>
        <select 
          className={styles.modalInput} 
          value={mortgageStatus} 
          onChange={e => setMortgageStatus(e.target.value)}
        >
          <option value="NONE">Нет ипотеки</option>
          <option value="PENDING">На рассмотрении</option>
          <option value="APPROVED">Одобрено банком</option>
          <option value="REJECTED">Отказ банка</option>
          <option value="ISSUED">Ипотека выдана</option>
        </select>
      </div>
    </div>

    <div style={{ marginBottom: '15px' }}>
      <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 800, fontSize: '1.25rem', color: '#475569', marginBottom: '5px' }}>Комментарий по ипотеке</label>
      <textarea 
        className={styles.modalInput} 
        style={{ minHeight: '60px' }}
        value={mortgageComment}
        onChange={e => setMortgageComment(e.target.value)}
        placeholder="Например: Одобрено под 7% годовых, ждем документы..."
      />
    </div>

    <button 
      className={styles.saveMortgageBtn}
      onClick={handleSaveMortgage}
      disabled={loading}
    >
      {loading ? 'Сохранение...' : '💾 Сохранить статус ипотеки'}
    </button>
  </div>
</main>

{/* Модалка добавления клиента */}
{showAddClientModal && (
  <div className={styles.overlay} onClick={() => setShowAddClientModal(false)}>
    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
      <header className={styles.modalHeader}>
        <h2 style={{ fontWeight: 800 }}>➕ Добавить участника сделки</h2>
        <button className={styles.closeBtn} onClick={() => setShowAddClientModal(false)}>✕</button>
      </header>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input 
          type="text" 
          className={styles.modalInput}
          placeholder="Имя, телефон или email..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button className={styles.quickCallBtn} onClick={handleSearchLeads}>🔍 Поиск</button>
      </div>
      
      {searchLoading && <p>Поиск...</p>}
      
      {searchResults.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', maxHeight: '250px', overflowY: 'auto', marginBottom: '16px' }}>
          {searchResults.map(lead => (
            <div 
              key={lead.id} 
              style={{ padding: '12px', cursor: 'pointer', background: selectedClient?.id === lead.id ? '#eff6ff' : 'white', borderBottom: '1px solid #e2e8f0' }}
              onClick={() => setSelectedClient(lead)}
            >
              <strong>{lead.name}</strong> – {lead.phone}
            </div>
          ))}
        </div>
      )}
      
      {selectedClient && (
        <div style={{ marginBottom: '16px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={isPrimaryClient} onChange={e => setIsPrimaryClient(e.target.checked)} />
            Сделать основным клиентом (на кого оформляется объект)
          </label>
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button className={styles.quickCallBtn} onClick={() => setShowAddClientModal(false)}>Отмена</button>
        <button className={styles.saveMortgageBtn} onClick={handleAddClient} disabled={!selectedClient}>
          Добавить
        </button>
      </div>
    </div>
  </div>
)}

{/* Модалка добавления объекта */}
{showAddUnitModal && (
  <div className={styles.overlay} onClick={() => setShowAddUnitModal(false)}>
    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
      <header className={styles.modalHeader}>
        <h2 style={{ fontWeight: 800 }}>🏢 Добавить объект недвижимости</h2>
        <button className={styles.closeBtn} onClick={() => setShowAddUnitModal(false)}>✕</button>
      </header>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
        <input 
          type="text" 
          className={styles.modalInput}
          placeholder="Номер квартиры или ЖК..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <button className={styles.quickCallBtn} onClick={handleSearchUnits}>🔍 Поиск</button>
      </div>
      
      {searchLoading && <p>Поиск...</p>}
      
      {searchResults.length > 0 && (
        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', maxHeight: '250px', overflowY: 'auto', marginBottom: '16px' }}>
          {searchResults.map(unit => (
            <div 
              key={unit.id} 
              style={{ padding: '12px', cursor: 'pointer', background: selectedUnit?.id === unit.id ? '#eff6ff' : 'white', borderBottom: '1px solid #e2e8f0' }}
              onClick={() => setSelectedUnit(unit)}
            >
              <strong>{unit.projectName}</strong> – №{unit.number} – ${Number(unit.price).toLocaleString()}
            </div>
          ))}
        </div>
      )}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button className={styles.quickCallBtn} onClick={() => setShowAddUnitModal(false)}>Отмена</button>
        <button className={styles.saveMortgageBtn} onClick={handleAddUnit} disabled={!selectedUnit}>
          Добавить
        </button>
      </div>
    </div>
  </div>
)}

{/* Модалка удаления объекта с причиной */}
{showRemoveUnitModal && (
  <div className={styles.overlay} onClick={() => setShowRemoveUnitModal(null)}>
    <div className={styles.modal} onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
      <header className={styles.modalHeader}>
        <h2 style={{ fontWeight: 800 }}>❌ Удаление объекта №{showRemoveUnitModal.number}</h2>
        <button className={styles.closeBtn} onClick={() => setShowRemoveUnitModal(null)}>✕</button>
      </header>
      
      <p style={{ marginBottom: '16px', color: '#64748b' }}>Укажите причину отказа от объекта:</p>
      
      <select 
        className={styles.modalInput} 
        value={deleteReason} 
        onChange={e => setDeleteReason(e.target.value)}
        style={{ marginBottom: '12px' }}
      >
        <option value="">-- Выберите причину --</option>
        {UNIT_DELETE_REASONS.map(reason => (
          <option key={reason} value={reason}>{reason}</option>
        ))}
      </select>
      
      {deleteReason === 'Другое' && (
        <input 
          type="text"
          className={styles.modalInput}
          placeholder="Укажите причину..."
          value={customDeleteReason}
          onChange={e => setCustomDeleteReason(e.target.value)}
        />
      )}
      
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
        <button className={styles.quickCallBtn} onClick={() => setShowRemoveUnitModal(null)}>Отмена</button>
        <button className={styles.saveMortgageBtn} onClick={handleRemoveUnit}>
          Подтвердить удаление
        </button>
      </div>
    </div>
  </div>
)}
          </div>
        </div>
      )}
    </div>
  );
}
