import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, ChevronDown, ChevronRight, Folder, FolderOpen, LucideIcon } from 'lucide-react';
import { supabase } from '../../../shared/services/supabase';
import { Category, Subcategory, CategoryFormData, SubcategoryFormData } from '../../../shared/types/inventory.types';
import BaseForm, { FormSection, FormField, FormInput, FormTextarea } from '../../../shared/components/forms/BaseForm';
import { useNotify } from '../../../shared/hooks/useNotify';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

interface CategoryManagerProps {
  onCategorySelect?: (categoryId: string) => void;
  onSubcategorySelect?: (subcategoryId: string) => void;
  selectedCategoryId?: string;
  selectedSubcategoryId?: string;
}

export default function CategoryManager({
  onCategorySelect,
  onSubcategorySelect,
  selectedCategoryId,
  selectedSubcategoryId
}: CategoryManagerProps) {
  const { error: notifyError, success: notifySuccess, confirm } = useNotify();
  const [categories, setCategories] = useState<Category[]>([]);
  const [subcategories, setSubcategories] = useState<Subcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showSubcategoryForm, setShowSubcategoryForm] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | undefined>();
  const [editingSubcategory, setEditingSubcategory] = useState<Subcategory | undefined>();
  const [selectedCategoryForSubcategory, setSelectedCategoryForSubcategory] = useState<Category | undefined>();

  useEffect(() => {
    fetchCategories();
    fetchSubcategories();
  }, []);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setCategories(data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubcategories = async () => {
    try {
      const { data, error } = await supabase
        .from('subcategories')
        .select('*, categories(*)')
        .order('sort_order', { ascending: true });
      
      if (error) throw error;
      setSubcategories(data || []);
    } catch (err) {
      console.error('Error fetching subcategories:', err);
    }
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleAddCategory = () => {
    setEditingCategory(undefined);
    setShowCategoryForm(true);
  };

  const handleEditCategory = (category: Category) => {
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleDeleteCategory = async (category: Category) => {
    const confirmed = await confirm(`¿Estás seguro de eliminar la categoría "${category.name}"? Esto también eliminará todas las subcategorías asociadas.`, 'Eliminar Categoría');
    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase.from('categories').delete().eq('id', category.id);
      if (error) throw error;
      await fetchCategories();
      await fetchSubcategories();
    } catch (err: any) {
      notifyError('Error al eliminar categoría: ' + err.message);
    }
  };

  const handleAddSubcategory = (category: Category) => {
    setSelectedCategoryForSubcategory(category);
    setEditingSubcategory(undefined);
    setShowSubcategoryForm(true);
  };

  const handleEditSubcategory = (subcategory: Subcategory) => {
    setEditingSubcategory(subcategory);
    setSelectedCategoryForSubcategory(subcategory.categories);
    setShowSubcategoryForm(true);
  };

  const handleDeleteSubcategory = async (subcategory: Subcategory) => {
    const confirmed = await confirm(`¿Estás seguro de eliminar la subcategoría "${subcategory.name}"?`, 'Eliminar Subcategoría');
    if (!confirmed) {
      return;
    }

    try {
      const { error } = await supabase.from('subcategories').delete().eq('id', subcategory.id);
      if (error) throw error;
      await fetchSubcategories();
    } catch (err: any) {
      notifyError('Error al eliminar subcategoría: ' + err.message);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const categoryData: CategoryFormData = {
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      icon: formData.get('icon') as string || undefined,
      description: formData.get('description') as string || undefined,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      is_active: true,
    };

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from('categories')
          .update({ ...categoryData, updated_at: new Date().toISOString() })
          .eq('id', editingCategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert([categoryData]);
        if (error) throw error;
      }
      await fetchCategories();
      notifySuccess('Categoría guardada exitosamente');
      setShowCategoryForm(false);
      setEditingCategory(undefined);
    } catch (err: any) {
      notifyError('Error al guardar categoría: ' + err.message);
    }
  };

  const handleSaveSubcategory = async (e: React.FormEvent) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    const subcategoryData: SubcategoryFormData = {
      category_id: selectedCategoryForSubcategory?.id || formData.get('category_id') as string,
      name: formData.get('name') as string,
      slug: formData.get('slug') as string,
      description: formData.get('description') as string || undefined,
      sort_order: parseInt(formData.get('sort_order') as string) || 0,
      is_active: true,
    };

    try {
      if (editingSubcategory) {
        const { error } = await supabase
          .from('subcategories')
          .update({ ...subcategoryData, updated_at: new Date().toISOString() })
          .eq('id', editingSubcategory.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('subcategories').insert([subcategoryData]);
        if (error) throw error;
      }
      await fetchSubcategories();
      notifySuccess('Subcategoría guardada exitosamente');
      setShowSubcategoryForm(false);
      setEditingSubcategory(undefined);
      setSelectedCategoryForSubcategory(undefined);
    } catch (err: any) {
      notifyError('Error al guardar subcategoría: ' + err.message);
    }
  };

  const getSubcategoriesForCategory = (categoryId: string) => {
    return subcategories.filter(sub => sub.category_id === categoryId);
  };

  const getCategoryIcon = (_icon?: string): LucideIcon => {
    // Return a default icon if none specified or if we can't map it
    return Folder;
  };

  if (loading) {
    return (
      <LoadingSpinner minHeight="0" size={48} className="py-8" label="Cargando categorías..." />
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-5 py-4 flex items-center justify-between">
        <h2 className="text-sm font-normal tracking-widest text-white">Gestión de Categorías</h2>
        <button
          onClick={handleAddCategory}
          className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-[10px] font-normal tracking-wider rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={14} />
          Nueva Categoría
        </button>
      </div>

      <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
        {categories.map(category => {
          const Icon = getCategoryIcon(category.icon);
          const isExpanded = expandedCategories.has(category.id);
          const categorySubcategories = getSubcategoriesForCategory(category.id);
          const isSelected = selectedCategoryId === category.id;

          return (
            <div key={category.id} className="border border-slate-100 rounded-lg overflow-hidden">
              <div
                className={`flex items-center justify-between p-3 cursor-pointer transition-colors ${
                  isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50'
                }`}
                onClick={() => {
                  toggleCategory(category.id);
                  onCategorySelect?.(category.id);
                }}
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCategory(category.id);
                    }}
                    className="p-1 hover:bg-slate-200 rounded transition-colors"
                  >
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </button>
                  <Icon size={18} className="text-slate-600" />
                  <div>
                    <span className="text-[12px] font-normal text-slate-800">{category.name}</span>
                    <span className="text-[10px] text-slate-400 ml-2">({categorySubcategories.length} subcategorías)</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddSubcategory(category);
                    }}
                    className="p-1.5 hover:bg-blue-100 text-blue-600 rounded transition-colors"
                    title="Agregar subcategoría"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditCategory(category);
                    }}
                    className="p-1.5 hover:bg-amber-100 text-amber-600 rounded transition-colors"
                    title="Editar categoría"
                  >
                    <Edit size={14} />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCategory(category);
                    }}
                    className="p-1.5 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                    title="Eliminar categoría"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {isExpanded && categorySubcategories.length > 0 && (
                <div className="bg-slate-50 border-t border-slate-100 p-2 space-y-1">
                  {categorySubcategories.map(subcategory => {
                    const isSubSelected = selectedSubcategoryId === subcategory.id;
                    return (
                      <div
                        key={subcategory.id}
                        className={`flex items-center justify-between p-2 pl-8 rounded cursor-pointer transition-colors ${
                          isSubSelected ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100'
                        }`}
                        onClick={() => onSubcategorySelect?.(subcategory.id)}
                      >
                        <div className="flex items-center gap-2">
                          <FolderOpen size={14} className="text-slate-500" />
                          <span className="text-[11px] font-normal text-slate-700">{subcategory.name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditSubcategory(subcategory);
                            }}
                            className="p-1 hover:bg-amber-100 text-amber-600 rounded transition-colors"
                            title="Editar subcategoría"
                          >
                            <Edit size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSubcategory(subcategory);
                            }}
                            className="p-1 hover:bg-rose-100 text-rose-600 rounded transition-colors"
                            title="Eliminar subcategoría"
                          >
                            <Trash2 size={12} />
                          </button>
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

      {showCategoryForm && (
        <BaseForm
          title={editingCategory ? 'Editar Categoría' : 'Nueva Categoría'}
          onClose={() => {
            setShowCategoryForm(false);
            setEditingCategory(undefined);
          }}
          onSubmit={handleSaveCategory}
          icon={<Folder size={24} className="text-blue-600" />}
        >
          <FormSection title="Información de la Categoría" color="blue">
            <FormField label="Nombre" required>
              <FormInput
                name="name"
                defaultValue={editingCategory?.name}
                placeholder="Nombre de la categoría"
                required
              />
            </FormField>
            <FormField label="Slug" required>
              <FormInput
                name="slug"
                defaultValue={editingCategory?.slug}
                placeholder="slug-de-la-categoria"
                required
              />
            </FormField>
            <FormField label="Icono">
              <FormInput
                name="icon"
                defaultValue={editingCategory?.icon}
                placeholder="Nombre del icono (ej: laptop, wrench, shield)"
              />
            </FormField>
            <FormField label="Descripción">
              <FormTextarea
                name="description"
                defaultValue={editingCategory?.description}
                placeholder="Descripción de la categoría"
                rows={3}
              />
            </FormField>
            <FormField label="Orden">
              <FormInput
                name="sort_order"
                type="number"
                defaultValue={editingCategory?.sort_order || 0}
                placeholder="0"
              />
            </FormField>
          </FormSection>
        </BaseForm>
      )}

      {showSubcategoryForm && selectedCategoryForSubcategory && (
        <BaseForm
          title={editingSubcategory ? 'Editar Subcategoría' : 'Nueva Subcategoría'}
          subtitle={`Categoría: ${selectedCategoryForSubcategory.name}`}
          onClose={() => {
            setShowSubcategoryForm(false);
            setEditingSubcategory(undefined);
            setSelectedCategoryForSubcategory(undefined);
          }}
          onSubmit={handleSaveSubcategory}
          icon={<FolderOpen size={24} className="text-blue-600" />}
        >
          <FormSection title="Información de la Subcategoría" color="blue">
            <FormField label="Nombre" required>
              <FormInput
                name="name"
                defaultValue={editingSubcategory?.name}
                placeholder="Nombre de la subcategoría"
                required
              />
            </FormField>
            <FormField label="Slug" required>
              <FormInput
                name="slug"
                defaultValue={editingSubcategory?.slug}
                placeholder="slug-de-la-subcategoria"
                required
              />
            </FormField>
            <FormField label="Descripción">
              <FormTextarea
                name="description"
                defaultValue={editingSubcategory?.description}
                placeholder="Descripción de la subcategoría"
                rows={3}
              />
            </FormField>
            <FormField label="Orden">
              <FormInput
                name="sort_order"
                type="number"
                defaultValue={editingSubcategory?.sort_order || 0}
                placeholder="0"
              />
            </FormField>
            <input
              type="hidden"
              name="category_id"
              value={selectedCategoryForSubcategory.id}
            />
          </FormSection>
        </BaseForm>
      )}
    </div>
  );
}
