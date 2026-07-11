const fs = require('fs');
let code = fs.readFileSync('src/pages/AdminPage.jsx', 'utf8');

// 1. Fix 'Yeni Koltuk Ekle' button in the barbers tab
const oldNewBtn = `setBarberForm({ name: '', active: true, role: 'barber', special_hours: null, special_break: null })
                   setEditingBarberId(null)`;
const newNewBtn = `setEditingBarber(null)
                   setBarberForm({ 
                     name: '', 
                     active: true, 
                     useDefaultHours: true,
                     working_hours: {
                       weekday: { start: '09:00', end: '20:00', closed: false, breaks: [] },
                       saturday: { start: '09:00', end: '22:00', closed: false, breaks: [] },
                       sunday: { start: '10:00', end: '18:00', closed: true, breaks: [] }
                     }
                   })`;
code = code.replace(oldNewBtn, newNewBtn);

// 2. Fix 'Düzenle' button in the barbers grid
const oldEditBtn = `setBarberForm({ 
                              name: b.name, 
                              active: b.active, 
                              role: b.role, 
                              special_hours: b.special_hours || null, 
                              special_break: b.special_break || null 
                            })
                            setEditingBarberId(b.barber_id)
                            setShowBarberModal(true)`;
const newEditBtn = `openEditBarber(b)`;
code = code.replace(oldEditBtn, newEditBtn);

// 3. Fix modal header 
code = code.replace(`{editingBarberId ? 'Koltuk Düzenle' : 'Yeni Koltuk Ekle'}`, `{editingBarber ? 'Koltuk Düzenle' : 'Yeni Koltuk Ekle'}`);

// 4. Fix savingService usage in the modal
code = code.replace(/disabled={savingService}/g, ``);
code = code.replace(/\{savingService \? 'Kaydediliyor\.\.\.' \: 'Kaydet'\}/g, `'Kaydet'`);

fs.writeFileSync('src/pages/AdminPage.jsx', code, 'utf8');
